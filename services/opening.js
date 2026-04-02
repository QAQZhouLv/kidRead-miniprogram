const { request } = require("../utils/api");

function getCreateOpening() {
  return request({
    url: "/api/openings/create",
    method: "GET"
  });
}

module.exports = {
  getCreateOpening
};