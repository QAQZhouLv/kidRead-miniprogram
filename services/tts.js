const { request } = require("../utils/api");
const { HTTP_BASE_URL } = require("../config/index");

function synthesizeTTS(data) {
  return request({
    url: "/api/tts/synthesize",
    method: "POST",
    data
  });
}

function toAbsoluteAudioUrl(audioUrl) {
  if (!audioUrl) return "";
  if (/^https?:\/\//.test(audioUrl)) return audioUrl;
  return `${HTTP_BASE_URL}${audioUrl}`;
}

module.exports = {
  synthesizeTTS,
  toAbsoluteAudioUrl
};
