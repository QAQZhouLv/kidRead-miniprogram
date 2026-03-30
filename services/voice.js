const { HTTP_BASE_URL } = require("../config/index");

function uploadVoice(tempFilePath) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: HTTP_BASE_URL + "/api/asr",
      filePath: tempFilePath,
      name: "file",
      success(res) {
        try {
          const data = JSON.parse(res.data);
          resolve(data);
        } catch (e) {
          reject(e);
        }
      },
      fail(err) {
        reject(err);
      }
    });
  });
}

module.exports = {
  uploadVoice
};