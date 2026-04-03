const {
  getUserProfile,
  saveUserProfile,
  markOnboardingSeen
} = require("../../utils/user-profile");
const { getTheme, getThemeOptions } = require("../../utils/theme");

Page({
  data: {
    step: 0, // 0 欢迎 1 昵称 2 年龄 3 主题 4 完成
    profile: {
      nickname: "童童",
      avatarUrl: "",
      avatarType: "default",
      age: 6,
      themeName: "sky",
      autoReadEnabled: true,
      readingMode: "day",
      fontScale: "medium"
    },
    ageOptions: Array.from({ length: 12 }, (_, i) => i + 1),
    ageIndex: 5,
    canUseProfileApi: !!wx.getUserProfile,
    themeOptions: getThemeOptions(),
    themeClass: "theme-sky"
  },

  onLoad() {
    const saved = getUserProfile();
    const age = saved.age || 6;
    const ageIndex = Math.max(0, Math.min(11, age - 1));
    const theme = getTheme(saved.themeName || "sky");

    this.setData({
      profile: {
        nickname: saved.nickname || "童童",
        avatarUrl: saved.avatarUrl || "",
        avatarType: saved.avatarType || "default",
        age,
        themeName: saved.themeName || "sky",
        autoReadEnabled: typeof saved.autoReadEnabled === "boolean" ? saved.autoReadEnabled : true,
        readingMode: saved.readingMode || "day",
        fontScale: saved.fontScale || "medium"
      },
      ageIndex,
      themeClass: theme.pageClass
    });
  },

  updateThemePreview(themeName) {
    const theme = getTheme(themeName);
    this.setData({
      "profile.themeName": theme.key,
      themeClass: theme.pageClass
    });
  },

  nextStep() {
    const next = Math.min(this.data.step + 1, 4);
    this.setData({ step: next });
  },

  prevStep() {
    const prev = Math.max(this.data.step - 1, 0);
    this.setData({ step: prev });
  },

  onNicknameInput(e) {
    this.setData({
      "profile.nickname": e.detail.value || ""
    });
  },

  onAgeChange(e) {
    const ageIndex = Number(e.detail.value || 0);
    const age = this.data.ageOptions[ageIndex] || 6;

    this.setData({
      ageIndex,
      "profile.age": age
    });
  },

  async onGetWechatProfile() {
    if (!wx.getUserProfile) {
      wx.showToast({
        title: "当前环境不支持",
        icon: "none"
      });
      return;
    }

    try {
      const res = await wx.getUserProfile({
        desc: "用于设置你的昵称和头像"
      });

      const userInfo = res.userInfo || {};
      this.setData({
        "profile.nickname": userInfo.nickName || this.data.profile.nickname || "童童",
        "profile.avatarUrl": userInfo.avatarUrl || "",
        "profile.avatarType": userInfo.avatarUrl ? "wechat" : "default"
      });
    } catch (err) {
      console.error("getUserProfile error:", err);
    }
  },

  confirmNickname() {
    const nickname = (this.data.profile.nickname || "").trim() || "童童";
    this.setData({
      "profile.nickname": nickname
    });
    this.nextStep();
  },

  onThemeTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    this.updateThemePreview(key);
  },

  completeOnboarding() {
    const profile = {
      nickname: (this.data.profile.nickname || "").trim() || "童童",
      avatarUrl: this.data.profile.avatarUrl || "",
      avatarType: this.data.profile.avatarUrl ? "wechat" : "default",
      age: this.data.profile.age || 6,
      themeName: this.data.profile.themeName || "sky",
      autoReadEnabled: true,
      readingMode: "day",
      fontScale: "medium"
    };

    saveUserProfile(profile);
    markOnboardingSeen();

    wx.showToast({
      title: "欢迎来到故事世界",
      icon: "success"
    });

    setTimeout(() => {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack({ delta: 1 });
      } else {
        wx.switchTab({
          url: "/pages/shelf/shelf"
        });
      }
    }, 500);
  }
});