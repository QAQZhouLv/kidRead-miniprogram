const { request } = require("../utils/api");

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

module.exports = {
  createStory,
  getStories,
  getStoryDetail,
  appendStory
};
