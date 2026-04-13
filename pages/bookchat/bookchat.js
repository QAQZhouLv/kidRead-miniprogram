const { getStoryDetail, appendStory } = require("../../services/story");
const { getMessagesBySession } = require("../../services/message");
const { createChatStream } = require("../../services/chat_stream");
const { createTTSPlayer, splitTextToSentences } = require("../../services/tts_player");
const { getUserProfile } = require("../../utils/user-profile");
const { applyThemeChrome } = require("../../utils/theme");
const {
  createSession,
  getSession,
  getSessions,
  updateSessionDraft,
  renameSession,
  pinSession,
  unpinSession,
  deleteSession
} = require("../../services/session");


function getNavMetrics() {
  const systemInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
  const statusBarHeight = systemInfo.statusBarHeight || 20;

  if (!menuButton) {
    return {
      statusBarHeight,
      navBarHeight: 44,
      navTotalHeight: statusBarHeight + 44,
      capsuleWidth: 88,
      capsuleHeight: 32
    };
  }

  const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height;
  return {
    statusBarHeight,
    navBarHeight,
    navTotalHeight: statusBarHeight + navBarHeight,
    capsuleWidth: menuButton.width,
    capsuleHeight: menuButton.height
  };
}


function buildStoryParagraphs(text = "") {
  const normalized = String(text || "")
    .replace(/\r/g, "")
    .trim();

  if (!normalized) return [];

  const rawParagraphs = normalized
    .split(/\n\s*\n+/)
    .map(item => item.replace(/\n/g, " ").trim())
    .filter(Boolean);

  const paragraphs = rawParagraphs.length ? rawParagraphs : [
    normalized.replace(/\n/g, " ").trim()
  ];

  let globalIndex = 0;

  return paragraphs.map((paragraph) => {
    const sentences = splitTextToSentences(paragraph).map((sentence) => ({
      text: sentence,
      index: globalIndex++
    }));

    return {
      text: paragraph,
      sentences
    };
  });
}

function decorateAssistantMessage(message = {}) {
  message.leadSentences = splitTextToSentences(message.leadText || "");
  message.storySentences = splitTextToSentences(message.storyText || "");
  message.storyParagraphs = buildStoryParagraphs(message.storyText || "");
  message.guideSentences = splitTextToSentences(message.guideText || "");
  return message;
}

Page({
  data: {
    storyId: null,
    story: null,
    loading: false,
    autoReadEnabled: true,
    playingMessageId: "",
    playingSection: "",
    playingSentenceIndex: -1,
    statusBarHeight: 20,
    navBarHeight: 44,
    navTotalHeight: 64,
    capsuleWidth: 88,
    capsuleHeight: 32,

    sessionId: "",
    sessionCreated: false,
    isHistorySession: false,

    drawerVisible: false,
    sessions: [],

    messages: [],
    draftText: "",
    sessionDraftSegments: [],
    sessionDraftText: "",
    hasUnsavedDraft: false,
    archiving: false,

    showEditPanel: false,
    editingText: "",
    openingPlayed: false,

    keyboardVisible: false,
    themeClass: 'theme-meadow',
    theme: applyThemeChrome('meadow')
  },

  async onLoad(options) {
    this.initNavBar();
    this.applyTheme();
    this.ttsPlayer = createTTSPlayer();
    this.bindTtsCallbacks();
    this._lastSavedDraft = null;

    const storyId = options.storyId;
    if (!storyId) {
      wx.showToast({
        title: "缺少 storyId",
        icon: "none"
      });
      return;
    }

    const hasSessionId = !!options.sessionId;
    const sessionId = hasSessionId ? options.sessionId : this.buildSessionId(storyId);

    this.setData({
      storyId: Number(storyId),
      sessionId,
      sessionCreated: hasSessionId,
      isHistorySession: hasSessionId
    });

    await this.loadStory();

    if (hasSessionId) {
      await this.restoreMessagesAndDraft();
    } else {
      this.initOpeningMessages();
    }

    await this.loadSessions();
  },

  initNavBar() {
    this.setData(getNavMetrics());
  },

  applyTheme() {
    const profile = getUserProfile();
    const theme = applyThemeChrome(profile.themeName);
    this.setData({
      autoReadEnabled: typeof profile.autoReadEnabled === 'boolean' ? profile.autoReadEnabled : true,
      themeClass: theme.pageClass,
      theme
    });
  },

  onShow() {
    this.applyTheme();
  },

  onTapNavBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: '/pages/shelf/shelf' });
  },

  onHide() {
    this.stopTTS();
  },

  onUnload() {
    if (this.ttsPlayer) {
      this.ttsPlayer.destroy();
      this.ttsPlayer = null;
    }
  },

  bindTtsCallbacks() {
    if (!this.ttsPlayer) return;

    this.ttsPlayer.setCallbacks({
      onSentenceStart: ({ messageId, section, sentenceIndex }) => {
        this.setData({
          playingMessageId: messageId,
          playingSection: section,
          playingSentenceIndex: sentenceIndex
        });
      },
      onPlayStateChange: ({ playing }) => {
        if (!playing) {
          this.resetPlayingState();
        }
      },
      onFinish: () => {
        this.resetPlayingState();
      },
      onError: () => {
        this.resetPlayingState();
        wx.showToast({ title: "朗读失败", icon: "none" });
      }
    });
  },

  resetPlayingState() {
    this.setData({
      playingMessageId: "",
      playingSection: "",
      playingSentenceIndex: -1
    });
  },


  stopTTS() {
    if (this.ttsPlayer) {
      this.ttsPlayer.stop();
    }
    this.resetPlayingState();
  },

  async playAssistantMessageFrom(message, startSection) {
    if (!this.data.autoReadEnabled) {
      this.stopTTS();
      wx.showToast({ title: "自动朗读已关闭", icon: "none" });
      return;
    }

    if (!message || message.role !== "assistant") return;
    await this.ttsPlayer.playMessage(message, startSection || "lead");
  },

  async autoPlayLatestAssistantMessage() {
    if (!this.data.autoReadEnabled) return;
    const messages = this.data.messages || [];
    const lastAssistant = [...messages].reverse().find(item => item.role === "assistant" && !item.pending);
    if (!lastAssistant) return;
    await this.playAssistantMessageFrom(lastAssistant, "lead");
  },

  onToggleAutoRead() {
    const next = !this.data.autoReadEnabled;
    this.setData({ autoReadEnabled: next });
    if (!next) {
      this.stopTTS();
    }
  },

  onSectionTap(e) {
    const detail = e.detail || {};
    const section = detail.section || "lead";
    const message =
      detail.message ||
      (this.data.messages || []).find(item => item.id === detail.messageId);
  
    if (!message) return;
    this.playAssistantMessageFrom(message, section);
  },

  buildSessionId(storyId) {
    return `story_${storyId}_${Date.now()}`;
  },

  initOpeningMessages() {
    const opening = this.data.isHistorySession
      ? decorateAssistantMessage({
          id: "opening_history",
          role: "assistant",
          leadText: "这是这本书的一次历史会话。",
          storyText: "",
          guideText: "你可以继续查看这次讨论，也可以在它的基础上继续聊。",
          choices: ["继续写下去", "解释上一段", "让故事更温柔"],
          shouldSave: false
        })
      : decorateAssistantMessage({
          id: "opening_new",
          role: "assistant",
          leadText: "我们来继续和这本书聊天吧！",
          storyText: "",
          guideText: "你可以问问题、继续写，或者调整故事内容。",
          choices: ["继续写下去", "解释上一段", "让故事更搞笑"],
          shouldSave: false
        });

    this.setData({
      messages: [opening],
      openingPlayed: false
    });

    openingPlayed: false
  },

  async loadStory() {
    try {
      const story = await getStoryDetail(this.data.storyId);
      this.setData({ story });
    } catch (err) {
      console.error("loadStory error:", err);
      wx.showToast({
        title: "加载故事失败",
        icon: "none"
      });
    }
  },

  async loadSessions() {
    try {
      const sessions = await getSessions({
        scene: "bookchat",
        storyId: this.data.storyId
      });
      this.setData({ sessions });
    } catch (err) {
      console.error("loadSessions error:", err);
    }
  },

  async ensureSessionIfNeeded() {
    if (this.data.sessionCreated) return;

    try {
      await createSession({
        scene: "bookchat",
        story_id: this.data.storyId,
        session_id: this.data.sessionId,
        title: this.data.isHistorySession ? "历史会话" : "新对话",
        summary: ""
      });

      this.setData({ sessionCreated: true });
      await this.loadSessions();
    } catch (err) {
      console.error("createSession error:", err);
    }
  },

  async restoreMessagesAndDraft() {
    try {
      const [session, rows] = await Promise.all([
        getSession(this.data.sessionId),
        getMessagesBySession(this.data.sessionId)
      ]);

      const messages = this.mapBackendMessagesToPageMessages(rows || []);
      const draftContent = (session?.draft_content || "").trim();
      const segments = draftContent
        ? draftContent.split("\n").map(s => s.trim()).filter(Boolean)
        : [];

      this.setData({
        sessionCreated: true,
        messages: messages.length ? messages : [],
        sessionDraftSegments: segments,
        sessionDraftText: segments.join("\n"),
        hasUnsavedDraft: segments.length > 0
      });

      if (!messages.length) {
        this.initOpeningMessages();
      }

      if (messages.length) {
        this.setData({ openingPlayed: true });
      }
    } catch (err) {
      console.error("restoreMessagesAndDraft error:", err);
      this.initOpeningMessages();
    }
  },

  mapBackendMessagesToPageMessages(rows = []) {
    return rows.map(item => {
      if (item.role === "user") {
        return {
          id: "u_" + item.id,
          role: "user",
          text: item.user_text || ""
        };
      }

      return decorateAssistantMessage({
        id: "a_" + item.id,
        role: "assistant",
        intent: item.intent || "",
        leadText: item.lead_text || "",
        storyText: item.story_text || "",
        guideText: item.guide_text || "",
        choices: item.choices || [],
        shouldSave: !!item.should_save
      });
    });
  },

  openDrawer() {
    this.setData({ drawerVisible: true });
    this.loadSessions();
  },

  closeDrawer() {
    this.setData({ drawerVisible: false });
  },

  onBarMenu() {
    this.openDrawer();
  },

  onBarFocus() {
    this.setData({ keyboardVisible: true });
  },

  onBarBlur() {
    this.setData({ keyboardVisible: false });
  },

  async startNewSessionFromDrawer() {
    this.stopTTS();
    const newSessionId = this.buildSessionId(this.data.storyId);

    this.setData({
      sessionId: newSessionId,
      sessionCreated: false,
      isHistorySession: false,
      drawerVisible: false,

      messages: [],
      draftText: "",
      sessionDraftSegments: [],
      sessionDraftText: "",
      hasUnsavedDraft: false
    });

    this.initOpeningMessages();
    await this.loadSessions();
  },

  async switchSessionFromDrawer(e) {
    const sessionId = e.detail.sessionId;
    if (!sessionId || sessionId === this.data.sessionId) {
      this.setData({ drawerVisible: false });
      return;
    }

    this.stopTTS();

    this.setData({
      sessionId,
      sessionCreated: true,
      isHistorySession: true,
      drawerVisible: false,

      messages: [],
      draftText: "",
      sessionDraftSegments: [],
      sessionDraftText: "",
      hasUnsavedDraft: false
    });

    await this.loadStory();
    await this.restoreMessagesAndDraft();
    await this.loadSessions();
  },

  async onDeleteSession(e) {
    const sessionId = e.detail.sessionId;
    if (!sessionId) return;

    try {
      await deleteSession(sessionId);
      await this.loadSessions();

      if (sessionId === this.data.sessionId) {
        await this.startNewSessionFromDrawer();
      }
    } catch (err) {
      console.error("deleteSession error:", err);
    }
  },

  // async onLongPressSession(e) {
  //   const { sessionId, title } = e.detail;

  //   wx.showActionSheet({
  //     itemList: ["重命名", "删除"],
  //     success: async (res) => {
  //       if (res.tapIndex === 0) {
  //         wx.showModal({
  //           title: "重命名会话",
  //           editable: true,
  //           placeholderText: "请输入新名称",
  //           content: title || "",
  //           success: async (modalRes) => {
  //             if (modalRes.confirm && modalRes.content) {
  //               try {
  //                 await renameSession(sessionId, modalRes.content);
  //                 await this.loadSessions();
  //               } catch (err) {
  //                 console.error("renameSession error:", err);
  //               }
  //             }
  //           }
  //         });
  //       } else if (res.tapIndex === 1) {
  //         await this.onDeleteSession({ detail: { sessionId } });
  //       }
  //     }
  //   });
  // },

  async onMoreSession(e) {
    const session = e.detail.session || {};
    const sessionId = session.session_id;
    const title = session.title || "";
    const isPinned = !!session.is_pinned;
  
    if (!sessionId) return;
  
    const itemList = isPinned
      ? ["重命名", "取消置顶", "删除"]
      : ["重命名", "置顶", "删除"];
  
    wx.showActionSheet({
      itemList,
      success: async (res) => {
        if (res.tapIndex === 0) {
          wx.showModal({
            title: "重命名会话",
            editable: true,
            placeholderText: "请输入新名称",
            content: title,
            success: async (modalRes) => {
              const value = (modalRes.content || "").trim();
              if (modalRes.confirm && value) {
                await renameSession(sessionId, value);
                await this.loadSessions();
              }
            }
          });
          return;
        }
  
        if (res.tapIndex === 1) {
          if (isPinned) {
            await unpinSession(sessionId);
          } else {
            await pinSession(sessionId);
          }
          await this.loadSessions();
          return;
        }
  
        if (res.tapIndex === 2) {
          await this.onDeleteSession({ detail: { sessionId } });
        }
      }
    });
  },

  onBarDraftChange(e) {
    this.setData({
      draftText: e.detail.text || ""
    });
  },

  onBarSend(e) {
    const text = (e.detail.text || "").trim();
    const inputMode = e.detail.inputMode || "text";
    if (!text || this.data.loading) return;

    this.sendMessage(text, inputMode);
    this.setData({
      draftText: ""
    });
  },

  openDraftEditor() {
    if (!this.data.draftText) return;
    this.setData({
      showEditPanel: true,
      editingText: this.data.draftText
    });
  },

  closeDraftEditor() {
    this.setData({
      showEditPanel: false
    });
  },

  onEditInput(e) {
    this.setData({
      editingText: e.detail.value || ""
    });
  },

  confirmDraftEdit() {
    this.setData({
      draftText: this.data.editingText || "",
      showEditPanel: false
    });
  },

  onChoiceTap(e) {
    const text = e.detail.text || e.detail.choice;
    if (!text || this.data.loading) return;
    this.sendMessage(text, "choice");
  },

  playOpeningIfNeeded() {
    if (!this.data.autoReadEnabled) return;
    if (this.data.openingPlayed) return;
    const firstAssistant = (this.data.messages || []).find(item => item.role === "assistant");
    if (!firstAssistant) return;
  
    setTimeout(async () => {
      try {
        await this.playAssistantMessageFrom(firstAssistant, "lead");
        this.setData({ openingPlayed: true });
      } catch (err) {
        console.error("playOpeningIfNeeded error:", err);
      }
    }, 300);
  },

  buildHistory(messages) {
    return messages.slice(-8).map(item => {
      if (item.role === "user") {
        return {
          role: "user",
          text: item.text || ""
        };
      }
      return {
        role: "assistant",
        lead_text: item.leadText || "",
        story_text: item.storyText || "",
        guide_text: item.guideText || "",
        choices: item.choices || []
      };
    });
  },

  isRewriteIntent(text, intent) {
    const t = (text || "").trim();
    if (intent !== "adjust_story") return false;

    const keywords = [
      "重写",
      "改写",
      "不要这一段",
      "不喜欢这一段",
      "换一段",
      "这段不行",
      "这一段不好"
    ];

    return keywords.some(k => t.includes(k));
  },

  async persistDraft() {
    const content = this.data.sessionDraftSegments.join("\n").trim();
    if (!content) return;
  
    await this.ensureSessionIfNeeded();
  
    if (this._lastSavedDraft === content) return;
    this._lastSavedDraft = content;
  
    try {
      await updateSessionDraft(this.data.sessionId, content);
    } catch (err) {
      console.error("persistDraft save error:", err);
      this._lastSavedDraft = null;
      return;
    }
  
    try {
      this.loadSessions();
    } catch (err) {
      console.warn("persistDraft loadSessions warn:", err);
    }
  },

  async sendMessage(text, inputMode = "text") {
    this.stopTTS();
    await this.ensureSessionIfNeeded();

    const userMsg = {
      id: "u_" + Date.now(),
      role: "user",
      text
    };

    const aiMsg = decorateAssistantMessage({
      id: "a_" + Date.now(),
      role: "assistant",
      intent: "",
      leadText: "",
      storyText: "",
      guideText: "",
      choices: [],
      shouldSave: false,
      saveMode: "append",
      pending: true,
      currentSection: ""
    });

    const nextMessages = [...this.data.messages, userMsg, aiMsg];

    this.setData({
      messages: nextMessages,
      loading: true
    });

    const stream = createChatStream(
      async (msg) => {
        const messages = [...this.data.messages];
        const lastIndex = messages.length - 1;
        const current = messages[lastIndex];

        if (!current || current.role !== "assistant") return;

        if (msg.type === "start") {
          current.pending = true;
        }

        if (msg.type === "intent") {
          current.intent = msg.intent || "";
        }

        if (msg.type === "section_start") {
          current.currentSection = msg.section || "";
        }

        if (msg.type === "section_delta") {
          const delta = msg.delta || "";
          const section = msg.section || current.currentSection;

          if (section === "lead") {
            current.leadText = (current.leadText || "") + delta;
          } else if (section === "story") {
            current.storyText = (current.storyText || "") + delta;
          } else if (section === "guide") {
            current.guideText = (current.guideText || "") + delta;
          }
        }

        if (msg.type === "section_replace") {
          const section = msg.section || "story";
          const content = msg.content || "";

          if (section === "lead") {
            current.leadText = content;
          } else if (section === "story") {
            current.storyText = content;
          } else if (section === "guide") {
            current.guideText = content;
          }
        }

        if (msg.type === "meta") {
          current.choices = msg.choices || [];
          current.shouldSave = !!msg.should_save;
          current.saveMode = msg.save_mode || "append";
        }

        decorateAssistantMessage(current);
        this.setData({ messages });

        if (msg.type === "done") {
          current.pending = false;
          current.currentSection = "";

          let draftSegments = [...this.data.sessionDraftSegments];
          const newStoryText = (current.storyText || "").trim();

          if (newStoryText && current.shouldSave) {
            if (this.isRewriteIntent(text, current.intent) && draftSegments.length > 0) {
              draftSegments[draftSegments.length - 1] = newStoryText;
            } else {
              draftSegments.push(newStoryText);
            }
          }

          decorateAssistantMessage(current);
          this.setData({
            messages,
            loading: false,
            sessionDraftSegments: draftSegments,
            sessionDraftText: draftSegments.join("\n"),
            hasUnsavedDraft: draftSegments.length > 0
          });

          if (newStoryText && current.shouldSave) {
            await this.persistDraft();
          }

          stream.close();
          await this.loadSessions();
          await this.autoPlayLatestAssistantMessage();
        }

        if (msg.type === "error") {
          current.pending = false;
          current.currentSection = "";
          current.leadText = "这次没有顺利生成。";
          current.guideText = "你可以再问一次，或者换一种说法。";
          current.choices = ["继续写下去", "解释一下", "换个方向"];
          decorateAssistantMessage(current);
          this.setData({ messages, loading: false });
          stream.close();
        }
      },
      (err) => {
        console.error("chat stream error:", err);
        this.setData({ loading: false });
      }
    );

    try {
      await stream.send({
        scene: "bookchat",
        story_id: Number(this.data.storyId),
        session_id: this.data.sessionId,
        age: this.data.story ? this.data.story.age : 8,
        input_mode: inputMode,
        text,
        history: this.buildHistory(nextMessages),
        current_story_content: this.data.story ? (this.data.story.content || "") : "",
        session_draft_content: this.data.sessionDraftSegments.join("\n")
      });
    } catch (err) {
      console.error("stream send error:", err);

      const messages = [...this.data.messages];
      const lastIndex = messages.length - 1;
      const current = messages[lastIndex];

      if (current && current.role === "assistant") {
        current.pending = false;
        current.leadText = "连接失败了。";
        current.guideText = "请检查后端服务和网络后再试一次。";
        current.choices = ["继续写下去", "再试一次"];
        decorateAssistantMessage(current);
      }

      this.setData({
        messages,
        loading: false
      });

      stream.close();
    }
  },

  async onArchiveSession() {
    await this.onConfirmAppend();
  },

  async onConfirmAppend() {
    const content = this.data.sessionDraftSegments.join("\n").trim();
    if (!content) {
      wx.showToast({
        title: "没有可写入的内容",
        icon: "none"
      });
      return;
    }
  
    if (this.data.archiving) return;
  
    this.setData({ archiving: true });
  
    try {
      await appendStory(this.data.storyId, content);
  
      wx.showToast({
        title: "已写入本书",
        icon: "success"
      });
  
      this.setData({
        sessionDraftSegments: [],
        sessionDraftText: "",
        hasUnsavedDraft: false,
        archiving: false
      });
  
      await updateSessionDraft(this.data.sessionId, "");
      await this.loadStory();
      await this.loadSessions();
    } catch (err) {
      console.error("appendStory error:", err);
  
      this.setData({ archiving: false });
  
      wx.showToast({
        title: "写入失败",
        icon: "none"
      });
    }
  }
});