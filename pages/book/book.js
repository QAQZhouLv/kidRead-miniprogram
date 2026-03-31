const { getStoryDetail } = require("../../services/story");
const { createTTSPlayer } = require("../../services/tts_player");

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

function splitContentToParagraphs(text = "") {
  const normalized = String(text || "")
    .replace(/\r/g, "")
    .trim();

  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n+/)
    .map(item => item.trim())
    .filter(Boolean);

  return paragraphs;
}

Page({
  data: {
    storyId: null,
    story: null,
    statusBarHeight: 20,
    navBarHeight: 44,
    navTotalHeight: 64,
    controlsVisible: false,
    isReading: false,
    contentParagraphs: []
  },

  onLoad(options) {
    this.setData(getNavMetrics());
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
    if (this.data.storyId) {
      this.loadStory();
    }
  },

  onHide() {
    this.stopReading();
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
      onPlayStateChange: ({ playing }) => {
        this.setData({ isReading: !!playing });
      },
      onFinish: () => {
        this.setData({ isReading: false });
      },
      onError: () => {
        this.setData({ isReading: false });
        wx.showToast({ title: "朗读失败", icon: "none" });
      }
    });
  },

  async loadStory() {
    try {
      const story = await getStoryDetail(this.data.storyId);
      this.setData({
        story,
        contentParagraphs: splitContentToParagraphs(story && story.content)
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
    this.stopReading();
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: "/pages/shelf/shelf" });
  },

  onPageTap() {
    this.setData({ controlsVisible: !this.data.controlsVisible });
  },

  stopReading() {
    if (this.ttsPlayer) {
      this.ttsPlayer.stop();
    }
    this.setData({ isReading: false });
  },

  async onListenTap() {
    const story = this.data.story;
    if (!story || !story.content) return;

    if (this.data.isReading) {
      this.stopReading();
      return;
    }

    const message = {
      id: `book_${story.id}`,
      role: "assistant",
      leadText: "",
      storyText: story.content || "",
      guideText: ""
    };

    await this.ttsPlayer.playMessage(message, "story");
  },

  onChatTap() {
    this.stopReading();
    const story = this.data.story;
    if (!story || !story.id) return;

    wx.navigateTo({
      url: `/pages/bookchat/bookchat?storyId=${story.id}`
    });
  }
});
