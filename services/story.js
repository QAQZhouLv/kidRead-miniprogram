const { request } = require("../utils/api");
const { HTTP_BASE_URL } = require("../config/index");

function toAbsoluteImageUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//.test(url)) return url;

  const normalized = String(url).startsWith("/") ? url : `/${url}`;
  return `${HTTP_BASE_URL}${normalized}`;
}

function createStory(data) {
  return request({
    url: "/api/stories",
    method: "POST",
    data
  });
}

function getStories() {
  return request({
    url: "/api/stories",
    method: "GET"
  });
}

function getStoryDetail(id) {
  return request({
    url: `/api/stories/${id}`,
    method: "GET"
  });
}

function appendStory(id, story_text) {
  return request({
    url: `/api/stories/${id}/append`,
    method: "POST",
    data: { story_text }
  });
}

function renameStory(id, title) {
  return request({
    url: `/api/stories/${id}/rename`,
    method: "PATCH",
    data: { title }
  });
}

function setStoryFavorite(id, is_favorite) {
  return request({
    url: `/api/stories/${id}/favorite`,
    method: "PATCH",
    data: { is_favorite }
  });
}

function deleteStory(id) {
  return request({
    url: `/api/stories/${id}`,
    method: "DELETE"
  });
}

module.exports = {
  createStory,
  getStories,
  getStoryDetail,
  appendStory,
  renameStory,
  setStoryFavorite,
  deleteStory,
  toAbsoluteImageUrl
};