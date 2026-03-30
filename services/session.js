const { request } = require("../utils/api");

function createSession(data) {
  return request({
    url: "/api/sessions",
    method: "POST",
    data
  });
}

function getSession(sessionId) {
  return request({
    url: `/api/sessions/${sessionId}`,
    method: "GET"
  });
}

function getSessions(params = {}) {
  const { scene, storyId } = params;

  let url = `/api/sessions?scene=${encodeURIComponent(scene || "create")}`;
  if (storyId !== undefined && storyId !== null) {
    url += `&story_id=${storyId}`;
  }

  return request({
    url,
    method: "GET"
  });
}

function updateSessionDraft(sessionId, draft_content) {
  return request({
    url: `/api/sessions/${sessionId}/draft`,
    method: "PUT",
    data: { draft_content }
  });
}

function renameSession(sessionId, title) {
  return request({
    url: `/api/sessions/${sessionId}/rename`,
    method: "PUT",
    data: { title }
  });
}

function deleteSession(sessionId) {
  return request({
    url: `/api/sessions/${sessionId}`,
    method: "DELETE"
  });
}

function mergeSession(sessionId) {
  return request({
    url: `/api/sessions/${sessionId}/merge`,
    method: "POST"
  });
}

module.exports = {
  createSession,
  getSession,
  getSessions,
  updateSessionDraft,
  renameSession,
  deleteSession,
  mergeSession
};