const { HTTP_BASE_URL } = require("./config/index");
const { getUserProfile } = require("./utils/user-profile");

const AUTH_TOKEN_KEY = "kidread_auth_token";
const AUTH_USER_KEY = "kidread_auth_user";
const DEV_OPENID_KEY = "kidread_dev_openid";

function requestWithoutAuth({ url, method = "GET", data = {}, timeout = 15000 }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: HTTP_BASE_URL + url,
      method,
      data,
      timeout,
      header: {
        "Content-Type": "application/json"
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(res.data || { message: "request failed" });
        }
      },
      fail(err) {
        reject(err);
      }
    });
  });
}

function wxLoginAsync() {
  return new Promise((resolve) => {
    wx.login({
      success(res) {
        resolve(res && res.code ? res.code : "");
      },
      fail() {
        resolve("");
      }
    });
  });
}

function buildRandomId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateDevOpenid() {
  try {
    const saved = wx.getStorageSync(DEV_OPENID_KEY);
    if (saved) return saved;
  } catch (err) {
    console.error("read dev openid error:", err);
  }

  const value = `dev_${buildRandomId()}`;
  try {
    wx.setStorageSync(DEV_OPENID_KEY, value);
  } catch (err) {
    console.error("save dev openid error:", err);
  }
  return value;
}

App({
  globalData: {
    userInfo: null,
    authToken: "",
    currentUser: null,
    authMode: ""
  },

  onLaunch() {
    const logs = wx.getStorageSync("logs") || [];
    logs.unshift(Date.now());
    wx.setStorageSync("logs", logs);

    const savedToken = wx.getStorageSync(AUTH_TOKEN_KEY) || "";
    const savedUser = wx.getStorageSync(AUTH_USER_KEY) || null;
    if (savedToken) {
      this.globalData.authToken = savedToken;
    }
    if (savedUser) {
      this.globalData.currentUser = savedUser;
      this.globalData.userInfo = savedUser;
    }

    this.ensureLogin().catch((err) => {
      console.error("ensureLogin onLaunch error:", err);
    });
  },

  async ensureLogin(force = false) {
    if (!force && this.globalData.authToken) {
      return this.globalData.authToken;
    }

    if (!force) {
      const cached = wx.getStorageSync(AUTH_TOKEN_KEY);
      if (cached) {
        this.globalData.authToken = cached;
        const savedUser = wx.getStorageSync(AUTH_USER_KEY) || null;
        this.globalData.currentUser = savedUser;
        this.globalData.userInfo = savedUser;
        return cached;
      }
    }

    if (this._loginPromise && !force) {
      return this._loginPromise;
    }

    this._loginPromise = (async () => {
      const code = await wxLoginAsync();
      const profile = getUserProfile();
      const devOpenid = getOrCreateDevOpenid();

      const resp = await requestWithoutAuth({
        url: "/api/auth/login",
        method: "POST",
        data: {
          code,
          dev_openid: devOpenid,
          nickname: profile.nickname || "童童",
          display_name: profile.nickname || "童童",
          avatar_url: profile.avatarUrl || ""
        }
      });

      if (!resp || !resp.token) {
        throw new Error("登录失败：后端未返回 token");
      }

      this.globalData.authToken = resp.token;
      this.globalData.currentUser = resp.user || null;
      this.globalData.userInfo = resp.user || null;
      this.globalData.authMode = resp.auth_mode || "";

      wx.setStorageSync(AUTH_TOKEN_KEY, resp.token);
      wx.setStorageSync(AUTH_USER_KEY, resp.user || null);

      return resp.token;
    })();

    try {
      return await this._loginPromise;
    } finally {
      this._loginPromise = null;
    }
  },

  getAuthToken() {
    return this.globalData.authToken || wx.getStorageSync(AUTH_TOKEN_KEY) || "";
  }
});
