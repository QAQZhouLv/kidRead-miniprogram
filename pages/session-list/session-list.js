const { getStoryDetail } = require("../../services/story");
const { getStorySessions } = require("../../services/session");

Page({
  data: {
    storyId: null,
    story: null,
    sessions: [],
    loading: false
  },

  async onLoad(options) {
    const storyId = options.storyId;
    if (!storyId) {
      wx.showToast({
        title: "缺少 storyId",
        icon: "none"
      });
      return;
    }

    this.setData({
      storyId: Number(storyId)
    });

    await this.loadStory();
    await this.loadSessions();
  },

  async onShow() {
    if (this.data.storyId) {
      await this.loadSessions();
    }
  },

  async loadStory() {
    try {
      const story = await getStoryDetail(this.data.storyId);
      this.setData({ story });

      wx.setNavigationBarTitle({
        title: (story.title || "会话历史") + " - 会话历史"
      });
    } catch (err) {
      console.error("loadStory error:", err);
    }
  },

  async loadSessions() {
    this.setData({ loading: true });

    try {
      const sessions = await getStorySessions(this.data.storyId);
      this.setData({
        sessions,
        loading: false
      });
    } catch (err) {
      console.error("getStorySessions error:", err);
      this.setData({ loading: false });

      wx.showToast({
        title: "加载会话失败",
        icon: "none"
      });
    }
  },

  openSession(e) {
    const sessionId = e.currentTarget.dataset.sessionid;
    if (!sessionId) return;

    wx.navigateTo({
      url: `/pages/bookchat/bookchat?storyId=${this.data.storyId}&sessionId=${sessionId}`
    });
  },

  startNewSession() {
    wx.navigateTo({
      url: `/pages/bookchat/bookchat?storyId=${this.data.storyId}`
    });
  }
});