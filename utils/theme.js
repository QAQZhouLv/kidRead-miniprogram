const THEME_MAP = {
  meadow: {
    key: "meadow",
    label: "糖果草地",
    pageClass: "theme-meadow",
    primary: "#58B368",
    secondary: "#A8E6A3",
    accent: "#FF9F43",
    warm: "#FFE66D",
    bg: "#F3FBEF",
    paper: "#FFFFFF",
    text: "#2E5D3B",
    navFrontColor: "#000000"
  },
  ocean: {
    key: "ocean",
    label: "晴空海洋",
    pageClass: "theme-ocean",
    primary: "#4DA6FF",
    secondary: "#BFE4FF",
    accent: "#FF7A59",
    warm: "#FFD166",
    bg: "#EAF6FF",
    paper: "#FFFFFF",
    text: "#2B4F73",
    navFrontColor: "#000000"
  },
  berry: {
    key: "berry",
    label: "莓果甜心",
    pageClass: "theme-berry",
    primary: "#FF6B81",
    secondary: "#FFC2C7",
    accent: "#7B6CF6",
    warm: "#FFE66D",
    bg: "#FFF1F3",
    paper: "#FFFFFF",
    text: "#6B2E3A",
    navFrontColor: "#000000"
  },
  sunny: {
    key: "sunny",
    label: "阳光拼贴",
    pageClass: "theme-sunny",
    primary: "#FFC93C",
    secondary: "#FFF3B0",
    accent: "#FF6B4A",
    warm: "#4D96FF",
    bg: "#FFF9E6",
    paper: "#FFFFFF",
    text: "#6E4C1E",
    navFrontColor: "#000000"
  },
  citrus: {
    key: "citrus",
    label: "橘子汽水",
    pageClass: "theme-citrus",
    primary: "#FF8C42",
    secondary: "#FFD166",
    accent: "#4D96FF",
    warm: "#6EE7B7",
    bg: "#FFF4E8",
    paper: "#FFFFFF",
    text: "#6A3B1A",
    navFrontColor: "#000000"
  },
  dream: {
    key: "dream",
    label: "星空梦境",
    pageClass: "theme-dream",
    primary: "#8B7CF6",
    secondary: "#D7D2FF",
    accent: "#FF9BD2",
    warm: "#FFE66D",
    bg: "#F4F2FF",
    paper: "#FFFFFF",
    text: "#3D3A70",
    navFrontColor: "#000000"
  }
};

const LEGACY_THEME_ALIAS = {
  sky: "ocean",
  peach: "berry",
  mint: "meadow",
  lagoon: "meadow"
};

function normalizeThemeName(themeName = "meadow") {
  return LEGACY_THEME_ALIAS[themeName] || themeName || "meadow";
}

function getTheme(themeName = "meadow") {
  const normalized = normalizeThemeName(themeName);
  return THEME_MAP[normalized] || THEME_MAP.meadow;
}

function getThemeOptions() {
  return Object.values(THEME_MAP).map((item) => ({
    key: item.key,
    label: item.label
  }));
}

function getThemeTokens(themeName = "meadow") {
  const theme = getTheme(themeName);
  return {
    ...theme,
    navSurface: "rgba(255, 248, 236, 0.92)",
    cardSurface: "rgba(255, 248, 236, 0.88)",
    cardSurfaceStrong: "rgba(255, 248, 236, 0.96)",
    softBorder: "rgba(130, 118, 98, 0.14)",
    dashedBorder: "rgba(130, 118, 98, 0.22)",
    inputText: theme.text,
    subtleText: theme.text,
    mutedText: theme.key === "dream" ? "#8E86C7" : "#8C816F",
    placeholderText: theme.key === "dream" ? "#AAA5D8" : "#B1B8C6",
    inverseText: "#FFFFFF",
    bellOnIcon: "#FFFFFF",
    bellOffIcon: theme.text,
    iconPrimary: theme.primary,
    iconText: theme.text,
    iconMuted: theme.key === "dream" ? "#AAA5D8" : "#A8B1BF",
    searchBorder: theme.secondary,
    emptyButtonGradient: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`
  };
}

function applyThemeChrome(themeName = "meadow") {
  const theme = getTheme(themeName);

  try {
    wx.setNavigationBarColor({
      frontColor: theme.navFrontColor || "#000000",
      backgroundColor: theme.paper
    });
  } catch (err) {
    console.error("setNavigationBarColor error:", err);
  }

  try {
    wx.setTabBarStyle({
      color: "#8D836E",
      selectedColor: theme.primary,
      backgroundColor: theme.paper,
      borderStyle: "white"
    });
  } catch (err) {
    console.error("setTabBarStyle error:", err);
  }

  return getThemeTokens(themeName);
}

module.exports = {
  THEME_MAP,
  normalizeThemeName,
  getTheme,
  getThemeTokens,
  getThemeOptions,
  applyThemeChrome
};
