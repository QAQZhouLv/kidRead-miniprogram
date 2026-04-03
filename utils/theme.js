const THEME_MAP = {
  sky: {
    key: "sky",
    label: "天空蓝",
    pageClass: "theme-sky",
    primary: "#7DB6FF",
    secondary: "#9DD8FF",
    soft: "#EAF5FF",
    accent: "#5C94F5",
    card: "#FFFFFF",
    bg: "#F7FAFF"
  },
  peach: {
    key: "peach",
    label: "蜜桃粉",
    pageClass: "theme-peach",
    primary: "#FFB38A",
    secondary: "#FFD1BA",
    soft: "#FFF1E8",
    accent: "#F28F5B",
    card: "#FFFFFF",
    bg: "#FFF8F4"
  },
  mint: {
    key: "mint",
    label: "薄荷绿",
    pageClass: "theme-mint",
    primary: "#78D7BE",
    secondary: "#B6F0DF",
    soft: "#EDFFF8",
    accent: "#3CB89B",
    card: "#FFFFFF",
    bg: "#F6FFFB"
  }
};

function getTheme(themeName = "sky") {
  return THEME_MAP[themeName] || THEME_MAP.sky;
}

function getThemeOptions() {
  return Object.values(THEME_MAP).map((item) => ({
    key: item.key,
    label: item.label
  }));
}

module.exports = {
  THEME_MAP,
  getTheme,
  getThemeOptions
};