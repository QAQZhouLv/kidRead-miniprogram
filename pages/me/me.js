const {
  getUserProfile,
  saveUserProfile,
  resetOnboardingFlag
} = require("../../utils/user-profile");
const { getThemeOptions, getTheme, applyThemeChrome } = require("../../utils/theme");

Page({
  data: {
    profile: {
      nickname: "童童",
      avatarUrl: "",
      avatarType: "default",
      age: 6,
      themeName: "meadow",
      autoReadEnabled: true,
      hasSeenOnboarding: false,
      readingMode: "day",
      fontScale: "medium",

      avatarText: "童"  
    },
    themeOptions: getThemeOptions(),
    ageOptions: Array.from({ length: 12 }, (_, i) => i + 1),
    readingModes: [
      { key: "day", label: "日间模式" },
      { key: "warm", label: "护眼模式" },
      { key: "night", label: "夜间模式" }
    ],
    fontScales: [
      { key: "small", label: "小号字" },
      { key: "medium", label: "标准字" },
      { key: "large", label: "大号字" }
    ],
    themeClass: "theme-meadow"
  },

  onShow() {
    this.loadProfile();
  },

  loadProfile() {
    const profile = getUserProfile();
    const theme = applyThemeChrome(profile.themeName);
  
    const nickname = profile.nickname && String(profile.nickname).trim()
      ? String(profile.nickname).trim()
      : "童童";
  
    this.setData({
      profile: {
        ...profile,
        nickname,
        avatarText: nickname.slice(0, 1)
      },
      themeClass: theme.pageClass
    });
  },

  onNicknameInput(e) {
    this.setData({
      "profile.nickname": e.detail.value || ""
    });
  },

  saveNickname() {
    const nickname = (this.data.profile.nickname || "").trim() || "童童";
    saveUserProfile({ nickname });
    this.loadProfile();

    wx.showToast({
      title: "称呼已保存",
      icon: "success"
    });
  },

  onAgeChange(e) {
    const ageIndex = Number(e.detail.value || 0);
    const age = this.data.ageOptions[ageIndex] || 6;
    saveUserProfile({ age });
    this.loadProfile();
  },

  onThemeTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;

    saveUserProfile({ themeName: key });
    this.loadProfile();

    wx.showToast({
      title: "主题已切换",
      icon: "success"
    });
  },

  onAutoReadChange(e) {
    const autoReadEnabled = !!e.detail.value;
    saveUserProfile({ autoReadEnabled });
    this.loadProfile();
  },

  onReadingModeTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;

    saveUserProfile({ readingMode: key });
    this.loadProfile();
  },

  onFontScaleTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;

    saveUserProfile({ fontScale: key });
    this.loadProfile();
  },

  onResetOnboarding() {
    resetOnboardingFlag();

    wx.showToast({
      title: "已重置欢迎引导",
      icon: "success"
    });
  },

  onOpenOnboardingNow() {
    wx.navigateTo({
      url: "/pages/onboarding/onboarding"
    });
  }
});