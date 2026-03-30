const { getStoryDetail } = require("../../services/story");

Page({
  data: {
    storyId: null,
    story: null
  },

  onLoad(options) {
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

  async loadStory() {
    try {
      const story = await getStoryDetail(this.data.storyId);
      this.setData({ story });

      wx.setNavigationBarTitle({
        title: story.title || "故事详情"
      });
    } catch (err) {
      console.error("getStoryDetail error:", err);
      wx.showToast({
        title: "加载失败",
        icon: "none"
      });
    }
  },

  goBookChat() {
    const story = this.data.story;
    if (!story || !story.id) return;

    wx.navigateTo({
      url: `/pages/bookchat/bookchat?storyId=${story.id}`
    });
  }
});