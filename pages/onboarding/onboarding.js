const {
  getUserProfile,
  saveUserProfile,
  markOnboardingSeen
} = require("../../utils/user-profile");

Page({
  data: {
    step: 0, // 0 welcome, 1 nickname, 2 age, 3 done
    profile: {
      nickname: "童童",
      avatarUrl: "",
      avatarType: "default",
      age: 6,
      themeName: "sky",
      autoReadEnabled: true
    },
    ageOptions: Array.from({ length: 12 }, (_, i) => i + 1),
    ageIndex: 5,
    canUseProfileApi: !!wx.getUserProfile
  },

  onLoad() {
    const saved = getUserProfile();
    const age = saved.age || 6;
    const ageIndex = Math.max(0, Math.min(18, age - 1));

    this.setData({
      profile: {
        nickname: saved.nickname || "小朋友",
        avatarUrl: saved.avatarUrl || "",
        avatarType: saved.avatarType || "default",
        age,
        themeName: saved.themeName || "sky",
        autoReadEnabled: typeof saved.autoReadEnabled === "boolean" ? saved.autoReadEnabled : true
      },
      ageIndex
    });
  },

  nextStep() {
    const next = Math.min(this.data.step + 1, 3);
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

  skipWechatProfile() {
    const nickname = (this.data.profile.nickname || "").trim() || "童童";
    this.setData({
      "profile.nickname": nickname,
      "profile.avatarType": "default"
    });
    this.nextStep();
  },

  confirmNickname() {
    const nickname = (this.data.profile.nickname || "").trim() || "童童";
    this.setData({
      "profile.nickname": nickname
    });
    this.nextStep();
  },

  completeOnboarding() {
    const profile = {
      nickname: (this.data.profile.nickname || "").trim() || "童童",
      avatarUrl: this.data.profile.avatarUrl || "",
      avatarType: this.data.profile.avatarUrl ? "wechat" : "default",
      age: this.data.profile.age || 6,
      themeName: this.data.profile.themeName || "sky",
      autoReadEnabled: true
    };

    saveUserProfile(profile);
    markOnboardingSeen();

    wx.showToast({
      title: "欢迎来到故事世界",
      icon: "success"
    });

    setTimeout(() => {
      wx.navigateBack({
        delta: 1
      });
    }, 500);
  }
});