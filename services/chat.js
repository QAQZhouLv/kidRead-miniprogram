const { request } = require("../utils/api");

function unifiedChat(data) {
  return request({
    url: "/api/chat/unified",
    method: "POST",
    data
  });
}

module.exports = {
  unifiedChat
};