const { getStories } = require("../../services/story");

Page({
  data: {
    stories: [],
    loading: false
  },

  onShow() {
    this.loadStories();
  },

  async loadStories() {
    this.setData({ loading: true });

    try {
      const stories = await getStories();
      this.setData({
        stories,
        loading: false
      });
    } catch (err) {
      console.error("getStories error:", err);
      this.setData({ loading: false });

      wx.showToast({
        title: "加载书架失败",
        icon: "none"
      });
    }
  },

  openBook(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    wx.navigateTo({
      url: `/pages/book/book?id=${id}`
    });
  },

  goCreate() {
    wx.navigateTo({
      url: "/pages/create/create"
    });
  }
});