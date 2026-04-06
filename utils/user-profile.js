const USER_PROFILE_KEY = "kidread_user_profile";

function getDefaultUserProfile() {
  return {
    profileReady: false,
    nickname: "童童",
    avatarUrl: "",
    avatarType: "default", // default | wechat
    age: 6,
    themeName: "meadow",
    autoReadEnabled: true,
    hasSeenOnboarding: false,
    readingMode: "day", // day | warm | night
    fontScale: "medium" // small | medium | large
  };
}

function getUserProfile() {
  try {
    const saved = wx.getStorageSync(USER_PROFILE_KEY);
    if (!saved) return getDefaultUserProfile();

    return {
      ...getDefaultUserProfile(),
      ...saved
    };
  } catch (err) {
    console.error("getUserProfile error:", err);
    return getDefaultUserProfile();
  }
}

function saveUserProfile(profile = {}) {
  const merged = {
    ...getDefaultUserProfile(),
    ...getUserProfile(),
    ...profile
  };

  try {
    wx.setStorageSync(USER_PROFILE_KEY, merged);
  } catch (err) {
    console.error("saveUserProfile error:", err);
  }

  return merged;
}

function markOnboardingSeen() {
  return saveUserProfile({
    hasSeenOnboarding: true,
    profileReady: true
  });
}

function resetOnboardingFlag() {
  return saveUserProfile({
    hasSeenOnboarding: false,
    profileReady: false
  });
}

module.exports = {
  USER_PROFILE_KEY,
  getDefaultUserProfile,
  getUserProfile,
  saveUserProfile,
  markOnboardingSeen,
  resetOnboardingFlag
};
