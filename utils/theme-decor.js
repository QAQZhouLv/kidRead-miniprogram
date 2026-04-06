const THEME_DECOR_MAP = {
  meadow: {
    decorType: "flowers",
    label: "花朵草地"
  },
  ocean: {
    decorType: "ocean",
    label: "海洋泡泡"
  },
  berry: {
    decorType: "candy",
    label: "莓果糖粒"
  },
  sunny: {
    decorType: "sun",
    label: "太阳拼贴"
  },
  citrus: {
    decorType: "citrus",
    label: "橘子汽水"
  },
  dream: {
    decorType: "stars",
    label: "星月梦境"
  }
};

function getThemeDecor(themeName = "meadow") {
  return THEME_DECOR_MAP[themeName] || THEME_DECOR_MAP.meadow;
}

module.exports = {
  THEME_DECOR_MAP,
  getThemeDecor
};