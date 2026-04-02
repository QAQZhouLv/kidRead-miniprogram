const {
  getUserProfile,
  saveUserProfile,
  resetOnboardingFlag
} = require("../../utils/user-profile");

Page({
  data: {
    profile: {
      nickname: "童童",
      avatarUrl: "",
      avatarType: "default",
      age: 6,
      themeName: "sky",
      autoReadEnabled: true,
      hasSeenOnboarding: false
    },
    themeOptions: [
      { key: "sky", label: "天空蓝" },
      { key: "peach", label: "蜜桃粉" },
      { key: "mint", label: "薄荷绿" }
    ],
    ageOptions: Array.from({ length: 12 }, (_, i) => i + 1)
  },

  onShow() {
    this.loadProfile();
  },

  loadProfile() {
    const profile = getUserProfile();
    this.setData({ profile });
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

  onResetOnboarding() {
    resetOnboardingFlag();

    wx.showToast({
      title: "已重置欢迎引导",
      icon: "success"
    });
  }
});