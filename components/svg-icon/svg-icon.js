const { getIcon } = require("../../utils/icon-registry");

function buildSvgMarkup(icon, color) {
  if (!icon) return "";

  const paths = (icon.paths || [])
    .map((d) => `<path d="${d}" fill="${color}"></path>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}">${paths}</svg>`;
}

function buildSvgDataUri(svgText) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgText)}`;
}

Component({
  properties: {
    name: { type: String, value: "" },
    color: { type: String, value: "#444444" },
    size: { type: String, value: "36rpx" },
    extClass: { type: String, value: "" }
  },

  data: {
    iconSrc: ""
  },

  observers: {
    "name,color": function(name, color) {
      this.updateIcon(name, color);
    }
  },

  lifetimes: {
    attached() {
      this.updateIcon(this.properties.name, this.properties.color);
    }
  },

  methods: {
    updateIcon(name, color) {
      const icon = getIcon(name);
      if (!icon) {
        this.setData({ iconSrc: "" });
        return;
      }
      const svg = buildSvgMarkup(icon, color || "#444444");
      const iconSrc = buildSvgDataUri(svg);
      this.setData({ iconSrc });
    }
  }
});
