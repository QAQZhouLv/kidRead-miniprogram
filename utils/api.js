const { HTTP_BASE_URL } = require("../config/index");

function rawRequest({ url, method = "GET", data = {}, timeout = 20000, header = {} }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: HTTP_BASE_URL + url,
      method,
      data,
      timeout,
      header,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(res.data || { statusCode: res.statusCode, message: "request failed" });
        }
      },
      fail(err) {
        reject(err);
      }
    });
  });
}

async function request({ url, method = "GET", data = {}, timeout = 20000, needAuth = true }) {
  let authToken = "";

  if (needAuth) {
    const app = getApp();
    if (app && typeof app.ensureLogin === "function") {
      try {
        await app.ensureLogin();
      } catch (err) {
        console.error("ensureLogin in request error:", err);
      }
      authToken = app.getAuthToken ? app.getAuthToken() : "";
    }
  }

  const header = {
    "Content-Type": "application/json"
  };
  if (authToken) {
    header.Authorization = `Bearer ${authToken}`;
  }

  try {
    return await rawRequest({ url, method, data, timeout, header });
  } catch (err) {
    const detail = err && (err.detail || err.message || err.errMsg || "");
    if (needAuth && String(detail).includes("token")) {
      const app = getApp();
      if (app && typeof app.ensureLogin === "function") {
        await app.ensureLogin(true);
        const retryToken = app.getAuthToken ? app.getAuthToken() : "";
        const retryHeader = {
          "Content-Type": "application/json"
        };
        if (retryToken) {
          retryHeader.Authorization = `Bearer ${retryToken}`;
        }
        return rawRequest({ url, method, data, timeout, header: retryHeader });
      }
    }
    throw err;
  }
}

module.exports = {
  request,
  rawRequest
};
