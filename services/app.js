const { request } = require("../utils/api");

function getBootstrapConfig() {
  return request({
    url: "/api/app/bootstrap",
    method: "GET"
  });
}

module.exports = {
  getBootstrapConfig
};