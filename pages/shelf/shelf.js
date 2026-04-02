const { getStories, toAbsoluteImageUrl } = require("../../services/story");

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
      const normalized = (stories || []).map(item => ({
        ...item,
        display_cover_url: toAbsoluteImageUrl(item.cover_image_url || item.fallback_cover_url)
      }));

      this.setData({
        stories: normalized,
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