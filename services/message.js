const { request } = require("../utils/api");

function getMessagesBySession(sessionId) {
  return request({
    url: `/api/messages/session/${sessionId}`,
    method: "GET"
  });
}

module.exports = {
  getMessagesBySession
};