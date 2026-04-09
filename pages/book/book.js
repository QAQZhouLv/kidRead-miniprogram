const { getStoryDetail } = require("../../services/story");
const { createTTSPlayer } = require("../../services/tts_player");
const { getUserProfile } = require("../../utils/user-profile");
const { applyThemeChrome } = require("../../utils/theme");

function getNavMetrics() {
  const systemInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
  const statusBarHeight = systemInfo.statusBarHeight || 20;

  if (!menuButton) {
    return {
      statusBarHeight,
      navBarHeight: 44,
      navTotalHeight: statusBarHeight + 44
    };
  }

  const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height;
  return {
    statusBarHeight,
    navBarHeight,
    navTotalHeight: statusBarHeight + navBarHeight
  };
}

function splitParagraphTexts(text = "") {
  const normalized = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return paragraphs.length ? paragraphs : [normalized];
}

function splitSentences(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return [];

  const parts = raw.match(/[^。！？!?；;：:\n]+[。！？!?；;：:]?|[^。！？!?；;：:\n]+$/g);
  if (!parts) return [raw];

  return parts
    .map((item) => item.trim())
    .filter(Boolean);
}

function isSpeakableText(text = "") {
  const cleaned = String(text || "")
    .replace(/[\s"'“”‘’《》〈〉「」『』【】（）()<>、，,。！？!?；;：:\-—…·~]/g, "")
    .trim();

  return !!cleaned;
}

function buildParagraphObjects(text = "") {
  let globalSentenceIndex = 0;

  return splitParagraphTexts(text).map((paragraphText, paragraphIndex) => ({
    id: `p_${paragraphIndex}`,
    text: paragraphText,
    paragraphIndex,
    speakable: isSpeakableText(paragraphText),
    sentences: splitSentences(paragraphText).map((sentenceText, sentenceIndex) => ({
      id: `p_${paragraphIndex}_s_${sentenceIndex}`,
      text: sentenceText,
      paragraphIndex,
      sentenceIndex,
      anchorId: `sent_${paragraphIndex}_${sentenceIndex}`,
      globalSentenceIndex: globalSentenceIndex++
    }))
  }));
}

function buildDisplayTitle(title = "") {
  const text = String(title || "").trim();
  if (!text) return "故事详情";
  return text;
}

function normalizeReaderModeByBg(readerBg) {
  return ["black", "gray", "brown"].includes(readerBg) ? "night" : "day";
}

function getReaderThemeBg(themeClass = "") {
  const map = {
    "theme-meadow": "#ECE6C9",
    "theme-ocean": "#E8EEF5",
    "theme-berry": "#F3E4E7",
    "theme-sunny": "#F6EAD9",
    "theme-citrus": "#F7E8D8",
    "theme-lagoon": "#E3F0EC"
  };
  return map[themeClass] || "#ECE6C9";
}

function getReaderStyle(readerBg, themeClass, fontSizeLevel, brightness) {
  const map = {
    white: {
      bg: "#F8F7F2",
      text: "#2E2E2E",
      mode: "day"
    },
    pink: {
      bg: "#F6ECEC",
      text: "#3A3131",
      mode: "day"
    },
    green: {
      bg: "#E8F1E4",
      text: "#2F3A2F",
      mode: "day"
    },
    theme: {
      bg: getReaderThemeBg(themeClass),
      text: "#403A31",
      mode: "day"
    },
    black: {
      bg: "#111111",
      text: "#F4F4F4",
      mode: "night"
    },
    gray: {
      bg: "#3E3E42",
      text: "#F2F2F2",
      mode: "night"
    },
    brown: {
      bg: "#2B1D16",
      text: "#F3E6D8",
      mode: "night"
    }
  };

  const fontMap = {
    "-1": 30,
    "0": 32,
    "1": 34,
    "2": 38
  };

  const style = map[readerBg] || map.theme;

  return {
    readerBgColor: style.bg,
    readerTextColor: style.text,
    actualReaderMode: style.mode,
    paragraphFontSize: fontMap[String(fontSizeLevel)] || 34,
    brightnessMaskOpacity: Math.max(0, ((100 - brightness) / 100) * 0.42)
  };
}

Page({
  data: {
    storyId: null,
    story: null,
    displayTitle: "故事详情",

    statusBarHeight: 20,
    navBarHeight: 44,
    navTotalHeight: 64,

    controlsVisible: false,
    showSettingsPanel: false,
    isReading: false,
    readingMode: false,

    contentParagraphs: [],
    themeClass: "theme-meadow",

    readerMode: "day",
    readerBg: "theme",
    readerBrightness: 80,
    fontSizeLevel: 1,
    pageEffect: "scroll",

    readerBgColor: "#ECE6C9",
    readerTextColor: "#403A31",
    actualReaderMode: "day",
    paragraphFontSize: 34,
    brightnessMaskOpacity: 0.08,

    activeParagraphIndex: -1,
    activeSentenceIndex: -1,
    activeSentenceAnchorId: "",
    readingQueue: [],
    readingCursor: 0
  },

  onLoad(options) {
    this._readingAbort = false;
    this._readingToken = 0;
    this._currentReadingParagraphIndex = -1;

    this.setData(getNavMetrics());
    this.applyTheme();
    this.loadReaderSettings();
    this.refreshReaderAppearance();

    this.ttsPlayer = createTTSPlayer();
    this.bindTtsCallbacks();

    const id = options.id;
    if (!id) {
      wx.showToast({
        title: "缺少故事 id",
        icon: "none"
      });
      return;
    }

    this.setData({ storyId: Number(id) });
    this.loadStory();
  },

  onShow() {
    this.applyTheme();
    this.refreshReaderAppearance();
    if (this.data.storyId) {
      this.loadStory();
    }
  },

  onHide() {
    this.stopReading({ keepControlsVisible: false });
  },

  onUnload() {
    this.stopReading({ keepControlsVisible: false });
    if (this.ttsPlayer) {
      this.ttsPlayer.destroy();
      this.ttsPlayer = null;
    }
  },

  applyTheme() {
    const profile = getUserProfile();
    const theme = applyThemeChrome(profile.themeName);
    const themeClass = theme.pageClass || "theme-meadow";

    this.setData({ themeClass }, () => {
      this.refreshReaderAppearance();
    });
  },

  loadReaderSettings() {
    try {
      const saved = wx.getStorageSync("book_reader_settings");
      if (!saved) return;

      const readerBg = saved.readerBg || "theme";
      const readerMode = normalizeReaderModeByBg(readerBg);

      this.setData({
        readerMode,
        readerBg,
        readerBrightness: typeof saved.readerBrightness === "number" ? saved.readerBrightness : 80,
        fontSizeLevel: typeof saved.fontSizeLevel === "number" ? saved.fontSizeLevel : 1,
        pageEffect: saved.pageEffect || "scroll"
      });
    } catch (err) {
      console.warn("loadReaderSettings error:", err);
    }
  },

  saveReaderSettings() {
    try {
      wx.setStorageSync("book_reader_settings", {
        readerMode: this.data.readerMode,
        readerBg: this.data.readerBg,
        readerBrightness: this.data.readerBrightness,
        fontSizeLevel: this.data.fontSizeLevel,
        pageEffect: this.data.pageEffect
      });
    } catch (err) {
      console.warn("saveReaderSettings error:", err);
    }
  },

  refreshReaderAppearance() {
    const result = getReaderStyle(
      this.data.readerBg,
      this.data.themeClass,
      this.data.fontSizeLevel,
      this.data.readerBrightness
    );

    this.setData({
      readerMode: result.actualReaderMode,
      readerBgColor: result.readerBgColor,
      readerTextColor: result.readerTextColor,
      actualReaderMode: result.actualReaderMode,
      paragraphFontSize: result.paragraphFontSize,
      brightnessMaskOpacity: result.brightnessMaskOpacity
    });
  },

  bindTtsCallbacks() {
    if (!this.ttsPlayer) return;

    this.ttsPlayer.setCallbacks({
      onSentenceStart: ({ section, sentenceIndex }) => {
        if (section !== "story") return;

        const paragraphIndex = this._currentReadingParagraphIndex;
        if (paragraphIndex < 0) return;

        const paragraphs = this.data.contentParagraphs || [];
        const paragraph = paragraphs[paragraphIndex];
        if (!paragraph) return;

        const idx = typeof sentenceIndex === "number" ? sentenceIndex : -1;
        const sentence = idx >= 0 ? paragraph.sentences[idx] : null;

        this.setData({
          activeParagraphIndex: paragraphIndex,
          activeSentenceIndex: idx,
          activeSentenceAnchorId: sentence ? sentence.anchorId : ""
        });
      },

      onPlayStateChange: ({ playing }) => {
        this.setData({ isReading: !!playing });
      },

      onFinish: () => {},

      onError: (err) => {
        console.error("book tts error:", err);
        this.stopReading();
        wx.showToast({ title: "朗读失败", icon: "none" });
      }
    });
  },

  async loadStory() {
    try {
      const story = await getStoryDetail(this.data.storyId);
      this.setData({
        story,
        displayTitle: buildDisplayTitle(story && story.title),
        contentParagraphs: buildParagraphObjects(story && story.content)
      });
    } catch (err) {
      console.error("getStoryDetail error:", err);
      wx.showToast({
        title: "加载失败",
        icon: "none"
      });
    }
  },

  onTapNavBack() {
    this.stopReading({ keepControlsVisible: false });
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: "/pages/shelf/shelf" });
  },

  onPageTap() {
    if (this.data.readingMode) return;

    if (this.data.showSettingsPanel) {
      this.setData({
        showSettingsPanel: false,
        controlsVisible: true
      });
      return;
    }

    this.setData({
      controlsVisible: !this.data.controlsVisible
    });
  },

  noop() {},

  buildPlayableParagraphQueue(startParagraphIndex = 0) {
    const paragraphs = this.data.contentParagraphs || [];
    const queue = [];

    for (let i = startParagraphIndex; i < paragraphs.length; i += 1) {
      const paragraph = paragraphs[i];
      if (!paragraph || !paragraph.text || !paragraph.speakable) continue;

      queue.push({
        paragraphIndex: i,
        text: paragraph.text,
        firstAnchorId:
          paragraph.sentences && paragraph.sentences[0]
            ? paragraph.sentences[0].anchorId
            : "",
        sentenceCount: (paragraph.sentences || []).length
      });
    }

    return queue;
  },

  createParagraphMessage(item) {
    return {
      id: `book_${this.data.storyId}_p_${item.paragraphIndex}`,
      role: "assistant",
      leadText: "",
      storyText: item.text,
      guideText: ""
    };
  },

  prefetchNextParagraph(queue, currentIndex) {
    if (!this.ttsPlayer || typeof this.ttsPlayer.preloadMessage !== "function") return;

    const next = queue[currentIndex + 1];
    if (!next || !next.text) return;

    const nextMessage = this.createParagraphMessage(next);
    this.ttsPlayer.preloadMessage(nextMessage, "story").catch((err) => {
      console.warn("prefetch next paragraph failed:", err);
    });
  },

  async startReadingFromParagraph(startParagraphIndex = 0) {
    const paragraphs = this.data.contentParagraphs || [];
    if (!paragraphs.length) return;
    if (startParagraphIndex < 0 || startParagraphIndex >= paragraphs.length) return;

    const queue = this.buildPlayableParagraphQueue(startParagraphIndex);
    if (!queue.length) {
      wx.showToast({ title: "没有可朗读内容", icon: "none" });
      return;
    }

    this.stopReading({ keepControlsVisible: true, silent: true });

    const token = Date.now();
    this._readingToken = token;
    this._readingAbort = false;

    const first = queue[0];

    this.setData({
      readingMode: true,
      controlsVisible: true,
      showSettingsPanel: false,
      isReading: true,
      readingQueue: queue,
      readingCursor: 0,
      activeParagraphIndex: first.paragraphIndex,
      activeSentenceIndex: 0,
      activeSentenceAnchorId: first.firstAnchorId || ""
    });

    await this.playParagraphQueue(queue, 0, token);
  },

  async playParagraphQueue(queue, index, token) {
    if (this._readingAbort || token !== this._readingToken) return;

    if (!queue || index >= queue.length) {
      this.stopReading();
      return;
    }

    const current = queue[index];
    if (!current || !current.text || !isSpeakableText(current.text)) {
      await this.playParagraphQueue(queue, index + 1, token);
      return;
    }

    this._currentReadingParagraphIndex = current.paragraphIndex;

    this.setData({
      readingCursor: index,
      activeParagraphIndex: current.paragraphIndex,
      activeSentenceIndex: 0,
      activeSentenceAnchorId: current.firstAnchorId || "",
      isReading: true
    });

    this.prefetchNextParagraph(queue, index);

    try {
      const message = this.createParagraphMessage(current);

      await this.ttsPlayer.playMessage(message, "story");

      if (this._readingAbort || token !== this._readingToken) return;

      await this.playParagraphQueue(queue, index + 1, token);
    } catch (err) {
      console.error("playParagraphQueue error:", err);
      this.stopReading();
      wx.showToast({ title: "朗读失败", icon: "none" });
    }
  },

  stopReading(options = {}) {
    const { keepControlsVisible = true, silent = false } = options;

    this._readingAbort = true;
    this._readingToken = 0;
    this._currentReadingParagraphIndex = -1;

    if (this.ttsPlayer) {
      this.ttsPlayer.stop();
    }

    this.setData({
      isReading: false,
      readingMode: false,
      controlsVisible: keepControlsVisible,
      activeParagraphIndex: -1,
      activeSentenceIndex: -1,
      activeSentenceAnchorId: "",
      readingQueue: [],
      readingCursor: 0
    });

    if (!silent) {
      this.setData({ showSettingsPanel: false });
    }
  },

  async onListenTap() {
    if (this.data.readingMode || this.data.isReading) {
      this.stopReading();
      return;
    }

    await this.startReadingFromParagraph(0);
  },

  async onParagraphTap(e) {
    if (!this.data.readingMode) {
      return;
    }

    const paragraphIndex = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(paragraphIndex)) return;

    await this.startReadingFromParagraph(paragraphIndex);
  },

  onChatTap() {
    this.stopReading({ keepControlsVisible: false });
    const story = this.data.story;
    if (!story || !story.id) return;

    wx.navigateTo({
      url: `/pages/bookchat/bookchat?storyId=${story.id}`
    });
  },

  onToggleDayNight() {
    const nextBg = this.data.actualReaderMode === "night" ? "theme" : "black";

    this.setData({
      readerBg: nextBg
    }, () => {
      this.refreshReaderAppearance();
      this.saveReaderSettings();
    });
  },

  onToggleSettingsPanel() {
    if (this.data.readingMode) return;

    const next = !this.data.showSettingsPanel;
    this.setData({
      controlsVisible: true,
      showSettingsPanel: next
    });
  },

  onBrightnessChanging(e) {
    this.setData({
      readerBrightness: Number(e.detail.value || 0)
    }, () => {
      this.refreshReaderAppearance();
    });
  },

  onBrightnessChange(e) {
    this.setData({
      readerBrightness: Number(e.detail.value || 0)
    }, () => {
      this.refreshReaderAppearance();
      this.saveReaderSettings();
    });
  },

  onFontSizeMinus() {
    const next = Math.max(-1, this.data.fontSizeLevel - 1);
    this.setData({
      fontSizeLevel: next
    }, () => {
      this.refreshReaderAppearance();
      this.saveReaderSettings();
    });
  },

  onFontSizePlus() {
    const next = Math.min(2, this.data.fontSizeLevel + 1);
    this.setData({
      fontSizeLevel: next
    }, () => {
      this.refreshReaderAppearance();
      this.saveReaderSettings();
    });
  },

  onSelectBg(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;

    this.setData({
      readerBg: key,
      readerMode: normalizeReaderModeByBg(key)
    }, () => {
      this.refreshReaderAppearance();
      this.saveReaderSettings();
    });
  },

  onSelectPageEffect(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;

    this.setData({
      pageEffect: key
    }, () => {
      this.saveReaderSettings();
    });
  }
});