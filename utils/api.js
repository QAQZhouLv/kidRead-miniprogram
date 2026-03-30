const { HTTP_BASE_URL } = require("../config/index");

function request({ url, method = "GET", data = {} }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: HTTP_BASE_URL + url,
      method,
      data,
      header: {
        "Content-Type": "application/json"
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(res.data);
        }
      },
      fail(err) {
        reject(err);
      }
    });
  });
}

module.exports = {
  request
};