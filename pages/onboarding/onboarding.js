// const { getTheme, applyThemeChrome, normalizeThemeName } = require("../../utils/theme");
const { getTheme, applyThemeChrome, normalizeThemeName, getThemeOptions } = require("../../utils/theme");
const { getThemeDecor } = require("../../utils/theme-decor");

const ROW_HEIGHT_RPX = 86;
const BASE_OFFSET_RPX = -ROW_HEIGHT_RPX;
const SWIPE_THRESHOLD_PX = 18;

Page({
  data: {
    step: 1,
    nickname: "",
    displayName: "小朋友",

    ageList: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    ageIndex: 2,
    selectedAge: 5,

    wheelAges: [],
    trackTranslateRpx: BASE_OFFSET_RPX,
    trackAnimating: false,

    ageTouchStartY: 0,
    ageTouchMoveY: 0,

    themeName: "meadow",
    themeClass: "theme-meadow",
    decorType: "flowers",
    theme: {},

    themeOptions: [],
    selectedTheme: "meadow"
  },

  onLoad(options = {}) {
    this.rpxRatio = 750 / wx.getSystemInfoSync().windowWidth;

    const savedTheme = wx.getStorageSync("kidread_theme") || "meadow";
    
    const incomingTheme = options.theme || savedTheme || "meadow";
    const themeName = normalizeThemeName(incomingTheme);
    const theme = getTheme(themeName);
    const decor = getThemeDecor(themeName);
    const themeOptions = getThemeOptions();

    applyThemeChrome(themeName);

    this.setData({
      themeName,
      selectedTheme: themeName,
      themeOptions,
      themeClass: theme.pageClass,
      decorType: decor.decorType,
      theme
    });

    this.refreshWheel();
  },

  onNicknameInput(e) {
    const nickname = e.detail.value || "";
    this.setData({
      nickname,
      displayName: nickname.trim() || "小朋友"
    });
  },

  syncPreview() {
    const nickname = (this.data.nickname || "").trim();
    this.setData({
      displayName: nickname || "小朋友"
    });
  },

  goStep2() {
    this.setData({ step: 2 });
  },

  goStep3() {
    this.syncPreview();
    this.setData({ step: 3 }, () => {
      this.refreshWheel();
    });
  },

  goStep4() {
    this.syncPreview();
    this.setData({ step: 4 });
  },

  goStep5() {
    this.syncPreview();
    this.setData({ step: 5 });
  },

  onSkipAll() {
    this.syncPreview();
    this.setData({ step: 5 });
  },

  buildWheelAges(ageIndex) {
    const { ageList } = this.data;

    const getAge = (idx) => {
      if (idx < 0 || idx > ageList.length - 1) return "";
      return ageList[idx];
    };

    return [
      getAge(ageIndex - 2),
      getAge(ageIndex - 1),
      getAge(ageIndex),
      getAge(ageIndex + 1),
      getAge(ageIndex + 2)
    ];
  },

  refreshWheel() {
    const { ageIndex, ageList } = this.data;
    this.setData({
      selectedAge: ageList[ageIndex],
      wheelAges: this.buildWheelAges(ageIndex),
      trackTranslateRpx: BASE_OFFSET_RPX,
      trackAnimating: false
    });
  },

  setAgeIndex(nextIndex) {
    const maxIndex = this.data.ageList.length - 1;
    let ageIndex = nextIndex;

    if (ageIndex < 0) ageIndex = 0;
    if (ageIndex > maxIndex) ageIndex = maxIndex;

    this.setData(
      {
        ageIndex
      },
      () => {
        this.refreshWheel();
      }
    );
  },

  onAgeTouchStart(e) {
    const y = e.touches[0].clientY;
    this.setData({
      ageTouchStartY: y,
      ageTouchMoveY: y,
      trackAnimating: false
    });
  },

  onAgeTouchMove(e) {
    const y = e.touches[0].clientY;
    const deltaPx = y - this.data.ageTouchStartY;
    let deltaRpx = deltaPx * this.rpxRatio * 0.55;

    const maxMove = ROW_HEIGHT_RPX * 0.9;
    if (deltaRpx > maxMove) deltaRpx = maxMove;
    if (deltaRpx < -maxMove) deltaRpx = -maxMove;

    this.setData({
      ageTouchMoveY: y,
      trackTranslateRpx: BASE_OFFSET_RPX + deltaRpx
    });
  },

  onAgeTouchEnd() {
    const { ageTouchStartY, ageTouchMoveY, ageIndex, ageList } = this.data;
    const deltaY = ageTouchMoveY - ageTouchStartY;
    const maxIndex = ageList.length - 1;

    if (Math.abs(deltaY) < SWIPE_THRESHOLD_PX) {
      this.setData({
        trackAnimating: true,
        trackTranslateRpx: BASE_OFFSET_RPX
      });
      return;
    }

    if (deltaY < 0) {
      if (ageIndex >= maxIndex) {
        this.setData({
          trackAnimating: true,
          trackTranslateRpx: BASE_OFFSET_RPX
        });
        return;
      }

      this.setData({
        trackAnimating: true,
        trackTranslateRpx: BASE_OFFSET_RPX - ROW_HEIGHT_RPX
      });

      setTimeout(() => {
        this.setAgeIndex(ageIndex + 1);
      }, 200);
      return;
    }

    if (ageIndex <= 0) {
      this.setData({
        trackAnimating: true,
        trackTranslateRpx: BASE_OFFSET_RPX
      });
      return;
    }

    this.setData({
      trackAnimating: true,
      trackTranslateRpx: BASE_OFFSET_RPX + ROW_HEIGHT_RPX
    });

    setTimeout(() => {
      this.setAgeIndex(ageIndex - 1);
    }, 200);
  },

  // onStartJourney() {
  //   const result = {
  //     nickname: this.data.displayName,
  //     age: this.data.selectedAge
  //   };

  //   wx.setStorageSync("onboardingDone", true);
  //   wx.setStorageSync("userProfile", result);

  //   wx.showToast({
  //     title: "准备出发啦",
  //     icon: "success"
  //   });

  //   console.log("onboarding result:", result);

  //   wx.switchTab({
  //     url: "/pages/shelf/shelf"
  //   });
  // },

  onStartJourney() {
    const result = {
      nickname: this.data.displayName,
      age: this.data.selectedAge,
      theme: this.data.selectedTheme
    };
  
    wx.setStorageSync("onboardingDone", true);
    wx.setStorageSync("userProfile", result);
    wx.setStorageSync("kidread_theme", this.data.selectedTheme);
  
    wx.showToast({
      title: "准备出发啦",
      icon: "success"
    });
  
    console.log("onboarding result:", result);
  
    setTimeout(() => {
      wx.switchTab({
        url: "/pages/shelf/shelf"
      });
    }, 300);
  },
  
  onSelectTheme(e) {
    const themeName = e.currentTarget.dataset.theme;
    if (!themeName) return;
  
    const normalized = normalizeThemeName(themeName);
    const theme = getTheme(normalized);
    const decor = getThemeDecor(normalized);
  
    applyThemeChrome(normalized);
  
    this.setData({
      selectedTheme: normalized,
      themeName: normalized,
      themeClass: theme.pageClass,
      decorType: decor.decorType,
      theme
    });
  },


});