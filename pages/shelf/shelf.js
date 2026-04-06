const {
  getStories,
  renameStory,
  setStoryFavorite,
  deleteStory,
  toAbsoluteImageUrl
} = require("../../services/story");
const { getBootstrapConfig } = require("../../services/app");
const { getUserProfile } = require("../../utils/user-profile");
const { applyThemeChrome } = require("../../utils/theme");

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
    themeIndex: pickThemeIndex(item),
    is_favorite: !!item.is_favorite
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
    favoriteStories: [],

    keyword: "",
    showSearchPanel: false,
    searchHistory: [],

    activeTab: "all",

    renameDialogVisible: false,
    renameStoryId: null,
    renameValue: "",
    renameOriginalTitle: "",
    submittingRename: false,

    actionSheetVisible: false,
    actionSheetTitle: "",
    actionStory: null,
    actionSource: "",

    hasCheckedOnboarding: false,

    themeName: "meadow",
    themeClass: "theme-meadow",
    theme: applyThemeChrome('meadow')
  },

  async onShow() {
    this.applyTheme();

    if (!this.data.hasCheckedOnboarding) {
      const shouldGo = await this.checkShouldShowOnboarding();
      if (shouldGo) {
        this.setData({ hasCheckedOnboarding: true });
        wx.navigateTo({
          url: "/pages/onboarding/onboarding"
        });
        return;
      }
      this.setData({ hasCheckedOnboarding: true });
    }

    this.loadShelfPage();
  },

  applyTheme() {
    const profile = getUserProfile();
    const theme = applyThemeChrome(profile.themeName);

    this.setData({
      themeName: theme.key,
      themeClass: theme.pageClass,
      theme
    });
  },

  async checkShouldShowOnboarding() {
    const profile = getUserProfile();

    try {
      const config = await getBootstrapConfig();
      if (config && config.force_show_onboarding) {
        return true;
      }
    } catch (err) {
      console.error("getBootstrapConfig error:", err);
    }

    return !profile.hasSeenOnboarding;
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
        favoriteStories: normalized.filter((item) => item.is_favorite),
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

  removeFromRecentReading(storyId) {
    const current = safeGetStorage(RECENT_READ_KEY, []);
    const next = current.filter((id) => String(id) !== String(storyId));
    safeSetStorage(RECENT_READ_KEY, next);

    this.setData({
      recentStories: this.buildRecentStories(this.data.stories)
    });
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

  onSwitchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab) return;
    this.setData({ activeTab: tab });
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

  onBookLongPress(e) {
    const story = e.currentTarget.dataset.story;
    const source = e.currentTarget.dataset.source || "all";
    if (!story) return;

    this.setData({
      actionSheetVisible: true,
      actionSheetTitle: story.displayTitle || "这本书",
      actionStory: story,
      actionSource: source
    });
  },

  closeActionSheet() {
    this.setData({
      actionSheetVisible: false,
      actionSheetTitle: "",
      actionStory: null,
      actionSource: ""
    });
  },

  async onActionTap(e) {
    const action = e.currentTarget.dataset.action;
    const story = this.data.actionStory;

    if (!story || !action) return;

    this.closeActionSheet();

    if (action === "rename") {
      this.openRenameDialog(story);
      return;
    }

    if (action === "toggleFavorite") {
      await this.handleToggleFavorite(story);
      return;
    }

    if (action === "removeFavorite") {
      await this.handleRemoveFavorite(story);
      return;
    }

    if (action === "removeRecent") {
      this.handleRemoveRecent(story);
      return;
    }

    if (action === "delete") {
      await this.handleDeleteStory(story);
    }
  },

  openRenameDialog(story) {
    this.setData({
      renameDialogVisible: true,
      renameStoryId: story.id,
      renameOriginalTitle: story.displayTitle || "",
      renameValue: story.displayTitle || "",
      submittingRename: false
    });
  },

  closeRenameDialog() {
    if (this.data.submittingRename) return;

    this.setData({
      renameDialogVisible: false,
      renameStoryId: null,
      renameOriginalTitle: "",
      renameValue: "",
      submittingRename: false
    });
  },

  onRenameInput(e) {
    this.setData({
      renameValue: e.detail.value || ""
    });
  },

  async submitRename() {
    if (this.data.submittingRename) return;

    const storyId = this.data.renameStoryId;
    const newTitle = String(this.data.renameValue || "").trim();

    if (!storyId) return;

    if (!newTitle) {
      wx.showToast({
        title: "书名不能为空",
        icon: "none"
      });
      return;
    }

    this.setData({ submittingRename: true });

    try {
      await renameStory(storyId, newTitle);

      wx.showToast({
        title: "已重命名",
        icon: "success"
      });

      this.setData({
        renameDialogVisible: false,
        renameStoryId: null,
        renameOriginalTitle: "",
        renameValue: "",
        submittingRename: false
      });

      await this.loadShelfPage();
    } catch (err) {
      console.error("renameStory error:", err);
      this.setData({ submittingRename: false });

      wx.showToast({
        title: "重命名失败",
        icon: "none"
      });
    }
  },

  async handleToggleFavorite(story) {
    try {
      await setStoryFavorite(story.id, !story.is_favorite);

      wx.showToast({
        title: !story.is_favorite ? "已设为喜欢" : "已取消喜欢",
        icon: "success"
      });

      await this.loadShelfPage();
    } catch (err) {
      console.error("setStoryFavorite error:", err);
      wx.showToast({
        title: "操作失败",
        icon: "none"
      });
    }
  },

  async handleRemoveFavorite(story) {
    try {
      await setStoryFavorite(story.id, false);

      wx.showToast({
        title: "已移出喜欢",
        icon: "success"
      });

      if (this.data.activeTab === "favorite") {
        this.setData({ activeTab: "all" });
      }

      await this.loadShelfPage();
    } catch (err) {
      console.error("remove favorite error:", err);
      wx.showToast({
        title: "操作失败",
        icon: "none"
      });
    }
  },

  handleRemoveRecent(story) {
    this.removeFromRecentReading(story.id);

    wx.showToast({
      title: "已移出最近阅读",
      icon: "success"
    });
  },

  async handleDeleteStory(story) {
    wx.showModal({
      title: "移入书架回收区",
      content: `要把《${story.displayTitle}》移出当前书架吗？`,
      confirmText: "移出",
      confirmColor: "#ff8a65",
      success: async (res) => {
        if (!res.confirm) return;

        try {
          await deleteStory(story.id);

          const currentRecent = safeGetStorage(RECENT_READ_KEY, []);
          const nextRecent = currentRecent.filter((id) => String(id) !== String(story.id));
          safeSetStorage(RECENT_READ_KEY, nextRecent);

          wx.showToast({
            title: "已移出书架",
            icon: "success"
          });

          await this.loadShelfPage();
        } catch (err) {
          console.error("deleteStory error:", err);
          wx.showToast({
            title: "操作失败",
            icon: "none"
          });
        }
      }
    });
  },

  noop() {},

  goCreate() {
    wx.switchTab({
      url: "/pages/create/create"
    });
  }
});