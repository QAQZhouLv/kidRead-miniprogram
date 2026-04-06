const { createStory } = require("../../services/story");
const { getMessagesBySession } = require("../../services/message");
const { createChatStream } = require("../../services/chat_stream");
const { createTTSPlayer, splitTextToSentences } = require("../../services/tts_player");
const { getCreateOpening } = require("../../services/opening");
const { getUserProfile } = require("../../utils/user-profile");
const { getTheme, applyThemeChrome } = require("../../utils/theme");
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
  const normalized = String(text || "").replace(/\r/g, "").trim();
  if (!normalized) return [];

  const rawParagraphs = normalized
    .split(/\n+/)
    .map(item => item.trim())
    .filter(Boolean);

  const paragraphs = rawParagraphs.length ? rawParagraphs : [normalized];
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

function decorateMessage(message = {}) {
  if (message.role !== "assistant") return { ...message };
  return decorateAssistantMessage(message);
}

Page({
  data: {
    age: 8,
    loading: false,
    autoReadEnabled: true,
    themeClass: 'theme-meadow',
    playingMessageId: "",
    playingSection: "",
    playingSentenceIndex: -1,
    statusBarHeight: 20,
    navBarHeight: 44,
    navTotalHeight: 64,
    capsuleWidth: 88,
    capsuleHeight: 32,

    sessionId: "create_" + Date.now(),
    sessionCreated: false,
    isHistorySession: false,
    createdStoryId: null,

    draftText: "",
    showEditPanel: false,
    editingText: "",

    archiving: false,

    drawerVisible: false,
    sessions: [],
    keyboardVisible: false,

    openingPlayed: false,
    
    bellIconColor: "#ffffff",
    bellOffIconColor: "#7a7062",

    messages: [
      decorateAssistantMessage({
        id: "opening_1",
        role: "assistant",
        leadText: "欢迎来到故事创作世界！",
        storyText: "",
        guideText: "你可以告诉我一个角色、一个地方，或者一件神奇的事情。",
        choices: ["写一个小猫故事", "写一个森林冒险", "写一个会发光的城堡"],
        shouldSave: false
      })
    ]
  },

  async onLoad() {
    this.initNavBar();
    this.applyTheme();
    this.ttsPlayer = createTTSPlayer();
    this.bindTtsCallbacks();
    await this.loadSessions();
    await this.loadCreateOpening();
  },

  initNavBar() {
    this.setData(getNavMetrics());
  },

  applyTheme() {
    const profile = getUserProfile();
    const theme = applyThemeChrome(profile.themeName);
    this.setData({
      age: profile.age || this.data.age,
      autoReadEnabled: typeof profile.autoReadEnabled === 'boolean' ? profile.autoReadEnabled : true,
      themeClass: theme.pageClass
    });
  },

  onShow() {
    this.applyTheme();
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
    const { message, section } = e.detail || {};
    this.playAssistantMessageFrom(message, section || "lead");
  },

  buildSessionId() {
    return "create_" + Date.now();
  },

  async ensureSessionIfNeeded() {
    if (this.data.sessionCreated) return;

    await createSession({
      scene: "create",
      story_id: 0,
      session_id: this.data.sessionId,
      title: "新创作",
      summary: ""
    });

    this.setData({ sessionCreated: true });
    await this.loadSessions();
  },

  buildOpeningMessage(payload = {}) {
    return decorateAssistantMessage({
      id: "opening_" + Date.now(),
      role: "assistant",
      leadText: payload.lead_text || "欢迎来到故事创作世界！",
      storyText: "",
      guideText: payload.guide_text || "先选一个你喜欢的故事方向吧。",
      choices: payload.choices || ["森林冒险", "星空旅行", "海底秘密"],
      shouldSave: false
    });
  },
  
  async loadCreateOpening() {
    try {
      const payload = await getCreateOpening();
      const opening = this.buildOpeningMessage(payload);
      this.setData({
        messages: [opening],
        openingPlayed: false
      });
      this.playOpeningIfNeeded();
    } catch (err) {
      console.error("loadCreateOpening error:", err);
      const opening = this.buildOpeningMessage();
      this.setData({
        messages: [opening],
        openingPlayed: false
      });
      this.playOpeningIfNeeded();
    }
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

  async loadSessions() {
    try {
      const sessions = await getSessions({ scene: "create" });
      this.setData({ sessions });
    } catch (err) {
      console.error("loadSessions error:", err);
    }
  },

  async persistDraft() {
    const text = (this.data.draftText || "").trim();
    if (!text) return;

    await this.ensureSessionIfNeeded();
    await updateSessionDraft(this.data.sessionId, this.data.draftText || "");
    await this.loadSessions();
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

  async startNewCreateSession() {
    this.stopTTS();
    const sessionId = this.buildSessionId();
  
    this.setData({
      drawerVisible: false,
      sessionId,
      sessionCreated: false,
      isHistorySession: false,
      createdStoryId: null,
      draftText: "",
      showEditPanel: false,
      editingText: "",
      messages: [],
      openingPlayed: false
    });
  
    await this.loadCreateOpening();
  },

  async switchCreateSession(e) {
    const sessionId = e.detail.sessionId;
    if (!sessionId || sessionId === this.data.sessionId) {
      this.setData({ drawerVisible: false });
      return;
    }

    this.stopTTS();

    try {
      const session = await getSession(sessionId);
      const rows = await getMessagesBySession(sessionId);
      const messages = this.mapBackendMessagesToPageMessages(rows);

      this.setData({
        drawerVisible: false,
        sessionId,
        sessionCreated: true,
        isHistorySession: true,
        draftText: session.draft_content || "",
        messages: messages.length
          ? messages
          : [
              decorateAssistantMessage({
                id: "opening_history_" + Date.now(),
                role: "assistant",
                leadText: "这是一次历史创作会话。",
                storyText: "",
                guideText: "你可以继续这个创意，也可以重新修改它。",
                choices: ["继续写下去", "换一个地点", "加一个新角色"],
                shouldSave: false
              })
            ]
      });
      this.playOpeningIfNeeded();
    } catch (err) {
      console.error("switchCreateSession error:", err);
      this.setData({ drawerVisible: false });
    }
  },

  async onDeleteSession(e) {
    const sessionId = e.detail.sessionId;
    if (!sessionId) return;

    try {
      await deleteSession(sessionId);
      await this.loadSessions();

      if (sessionId === this.data.sessionId) {
        this.startNewCreateSession();
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
  //               await renameSession(sessionId, modalRes.content);
  //               await this.loadSessions();
  //             }
  //           }
  //         });
  //       } else if (res.tapIndex === 1) {
  //         await this.onDeleteSession({ detail: { sessionId } });
  //       }
  //     }
  //   });
  // },

  onChoiceTap(e) {
    const text = e.detail.text;
    if (!text || this.data.loading) return;
    this.sendMessage(text, "choice");
  },

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
        const tapIndex = res.tapIndex;
  
        if (tapIndex === 0) {
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
  
        if (tapIndex === 1) {
          if (isPinned) {
            await unpinSession(sessionId);
          } else {
            await pinSession(sessionId);
          }
          await this.loadSessions();
          return;
        }
  
        if (tapIndex === 2) {
          await this.onDeleteSession({ detail: { sessionId } });
        }
      }
    });
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
      loading: true,
      draftText: ""
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
          decorateAssistantMessage(current);
          this.setData({ messages, loading: false });
          stream.close();
          await this.loadSessions();
          await this.autoPlayLatestAssistantMessage();
        }

        if (msg.type === "error") {
          current.pending = false;
          current.currentSection = "";
          current.leadText = "这次生成失败了。";
          current.guideText = "你可以再试一次，或者换一种说法。";
          current.choices = ["再试一次", "换个故事点子"];
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
        scene: "create",
        story_id: this.data.createdStoryId,
        session_id: this.data.sessionId,
        age: this.data.age,
        input_mode: inputMode,
        text,
        history: [],
        current_story_content: "",
        session_draft_content: this.collectStoryText(nextMessages)
      });
    } catch (err) {
      console.error("stream send error:", err);

      const messages = [...this.data.messages];
      const lastIndex = messages.length - 1;
      const current = messages[lastIndex];

      if (current && current.role === "assistant") {
        current.pending = false;
        current.leadText = "连接失败了。";
        current.guideText = "请检查后端服务和局域网地址后再试一次。";
        current.choices = ["再试一次"];
        decorateAssistantMessage(current);
      }

      this.setData({
        messages,
        loading: false
      });

      stream.close();
    }
  },

  collectStoryText(messages = this.data.messages) {
    return messages
      .filter(item => item.role === "assistant" && item.storyText)
      .map(item => item.storyText)
      .join("\n");
  },

  
  async onArchiveStory() {
    if (this.data.archiving) return;
  
    const content = this.collectStoryText();
  
    if (!content.trim()) {
      wx.showToast({
        title: "没有新故事哦，和慧童聊一聊吧",
        icon: "none"
      });
      return;
    }
  
    this.setData({ archiving: true });
  
    wx.showLoading({
      title: "正在归档...",
      mask: true
    });
  
    try {
      const story = await createStory({
        title: "",
        age: this.data.age,
        summary: "",
        content
      });
  
      this.setData({
        createdStoryId: story.id,
        archiving: false
      });
  
      wx.hideLoading();
  
      wx.showToast({
        title: "已归档成新书",
        icon: "success"
      });
    } catch (err) {
      console.error("createStory error:", err);
  
      this.setData({
        archiving: false
      });
  
      wx.hideLoading();
  
      wx.showToast({
        title: "归档失败",
        icon: "none"
      });
    }
  },

  onBarDraftChange(e) {
    this.setData({
      draftText: e.detail.text || ""
    });
    this.persistDraft();
  },

  onBarSend(e) {
    const text = (e.detail.text || "").trim();
    const inputMode = e.detail.inputMode || "text";
    if (!text || this.data.loading) return;

    this.sendMessage(text, inputMode);
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
    this.persistDraft();
  }
});