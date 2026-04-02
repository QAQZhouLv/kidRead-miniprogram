const { getStories, toAbsoluteImageUrl } = require("../../services/story");

const SEARCH_HISTORY_KEY = "kidread_shelf_search_history";
const RECENT_READ_KEY = "kidread_recent_reading_ids";
const MAX_HISTORY = 10;
const MAX_RECENT = 3;

function pickThemeIndex(story) {
  const seedSource = `${story.id || ""}${story.title || ""}${story.age || ""}`;
  let hash = 0;

  for (let i = 0; i < seedSource.length; i++) {
    hash = (hash * 31 + seedSource.charCodeAt(i)) % 100000;
  }

  return hash % 6;
}

function normalizeDate(input) {
  if (!input) return "";

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return String(input).replace("T", " ").slice(0, 16);
  }

  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function normalizeStories(stories = []) {
  return stories.map((item) => ({
    ...item,
    ai_cover_url: toAbsoluteImageUrl(item.cover_image_url),
    displayTitle: item.title || "未命名故事",
    displayAge: item.age || "未知",
    displayDate: normalizeDate(item.updated_at || item.created_at),
    themeIndex: pickThemeIndex(item)
  }));
}

function safeGetStorage(key, fallback) {
  try {
    const value = wx.getStorageSync(key);
    return value || fallback;
  } catch (err) {
    console.error(`getStorageSync ${key} error:`, err);
    return fallback;
  }
}

function safeSetStorage(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (err) {
    console.error(`setStorageSync ${key} error:`, err);
  }
}

Page({
  data: {
    loading: false,
    stories: [],
    filteredStories: [],
    recentStories: [],

    keyword: "",
    showSearchPanel: false,
    searchHistory: []
  },

  onShow() {
    this.loadShelfPage();
  },

  async loadShelfPage() {
    this.setData({ loading: true });

    try {
      const stories = await getStories();
      const normalized = normalizeStories(stories || []);
      const searchHistory = safeGetStorage(SEARCH_HISTORY_KEY, []);

      this.setData({
        stories: normalized,
        filteredStories: this.filterStories(normalized, this.data.keyword),
        recentStories: this.buildRecentStories(normalized),
        searchHistory,
        loading: false
      });
    } catch (err) {
      console.error("loadShelfPage error:", err);
      this.setData({ loading: false });

      wx.showToast({
        title: "加载书架失败",
        icon: "none"
      });
    }
  },

  filterStories(stories = [], keyword = "") {
    const trimmed = String(keyword || "").trim().toLowerCase();
    if (!trimmed) return stories;

    return stories.filter((item) => {
      const title = String(item.displayTitle || "").toLowerCase();
      const summary = String(item.summary || "").toLowerCase();
      return title.includes(trimmed) || summary.includes(trimmed);
    });
  },

  buildRecentStories(stories = []) {
    const ids = safeGetStorage(RECENT_READ_KEY, []);
    if (!Array.isArray(ids) || ids.length === 0) return [];

    const map = new Map();
    stories.forEach((item) => {
      map.set(String(item.id), item);
    });

    return ids
      .map((id) => map.get(String(id)))
      .filter(Boolean)
      .slice(0, MAX_RECENT);
  },

  updateRecentReading(storyId) {
    if (!storyId && storyId !== 0) return;

    const current = safeGetStorage(RECENT_READ_KEY, []);
    const normalizedId = String(storyId);

    const next = [
      normalizedId,
      ...current.filter((id) => String(id) !== normalizedId)
    ].slice(0, MAX_RECENT);

    safeSetStorage(RECENT_READ_KEY, next);
  },

  updateSearchHistory(keyword) {
    const trimmed = String(keyword || "").trim();
    if (!trimmed) return;

    const current = safeGetStorage(SEARCH_HISTORY_KEY, []);
    const next = [
      trimmed,
      ...current.filter((item) => item !== trimmed)
    ].slice(0, MAX_HISTORY);

    safeSetStorage(SEARCH_HISTORY_KEY, next);
    this.setData({ searchHistory: next });
  },

  onSearchInput(e) {
    const keyword = e.detail.value || "";
    const filteredStories = this.filterStories(this.data.stories, keyword);

    this.setData({
      keyword,
      filteredStories,
      showSearchPanel: !!String(keyword).trim()
    });
  },

  onSearchFocus() {
    this.setData({
      showSearchPanel: true
    });
  },

  onSearchConfirm(e) {
    const keyword = (e.detail.value || this.data.keyword || "").trim();

    this.setData({
      keyword,
      filteredStories: this.filterStories(this.data.stories, keyword),
      showSearchPanel: true
    });

    if (keyword) {
      this.updateSearchHistory(keyword);
    }
  },

  onTapSearchIcon() {
    const keyword = (this.data.keyword || "").trim();

    this.setData({
      filteredStories: this.filterStories(this.data.stories, keyword),
      showSearchPanel: true
    });

    if (keyword) {
      this.updateSearchHistory(keyword);
    }
  },

  onUseHistoryKeyword(e) {
    const keyword = e.currentTarget.dataset.keyword || "";
    this.setData({
      keyword,
      filteredStories: this.filterStories(this.data.stories, keyword),
      showSearchPanel: true
    });
    this.updateSearchHistory(keyword);
  },

  onDeleteHistoryItem(e) {
    const keyword = e.currentTarget.dataset.keyword || "";
    const next = this.data.searchHistory.filter((item) => item !== keyword);

    safeSetStorage(SEARCH_HISTORY_KEY, next);
    this.setData({ searchHistory: next });
  },

  onClearHistory() {
    safeSetStorage(SEARCH_HISTORY_KEY, []);
    this.setData({ searchHistory: [] });
  },

  onCancelSearch() {
    this.setData({
      keyword: "",
      filteredStories: this.data.stories,
      showSearchPanel: false
    });
  },

  openBook(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    this.updateRecentReading(id);

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