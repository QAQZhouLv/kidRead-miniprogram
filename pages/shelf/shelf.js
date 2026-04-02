const { getStories, toAbsoluteImageUrl } = require("../../services/story");

function pickThemeIndex(story) {
  const seedSource = `${story.id || ""}${story.title || ""}${story.age || ""}`;
  let hash = 0;

  for (let i = 0; i < seedSource.length; i++) {
    hash = (hash * 31 + seedSource.charCodeAt(i)) % 100000;
  }

  return hash % 6;
}

function formatDateTime(input) {
  if (!input) return "";

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return String(input).replace("T", " ").slice(0, 16);
  }

  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  const hh = `${date.getHours()}`.padStart(2, "0");
  const mm = `${date.getMinutes()}`.padStart(2, "0");

  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function normalizeStories(stories = []) {
  return stories.map((item) => {
    const aiCoverUrl = toAbsoluteImageUrl(item.cover_image_url);

    return {
      ...item,
      ai_cover_url: aiCoverUrl,
      themeIndex: pickThemeIndex(item),
      displayTitle: item.title || "未命名故事",
      displayDate: formatDateTime(item.updated_at || item.created_at)
    };
  });
}

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
        stories: normalizeStories(stories || []),
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
    wx.switchTab({
      url: "/pages/create/create"
    });
  }
});