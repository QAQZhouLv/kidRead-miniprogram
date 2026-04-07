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
    text: "#34306D",
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

function getReadingModeTokens(mode = "day") {
  if (mode === "warm") {
    return {
      paperTint: "#FFF8EC",
      cardTint: "rgba(255, 248, 236, 0.96)",
      strongCardTint: "rgba(255, 250, 242, 0.98)",
      bodyBg: "#F6EAD7",
      textBoost: "#5A4A37",
      mutedBoost: "#8B7965"
    };
  }
  if (mode === "night") {
    return {
      paperTint: "#F3F0EA",
      cardTint: "rgba(245, 240, 232, 0.96)",
      strongCardTint: "rgba(248, 244, 238, 0.98)",
      bodyBg: "#E7DDCF",
      textBoost: "#40362B",
      mutedBoost: "#726455"
    };
  }
  return {
    paperTint: null,
    cardTint: null,
    strongCardTint: null,
    bodyBg: null,
    textBoost: null,
    mutedBoost: null
  };
}

function getFontScaleTokens(scale = "medium") {
  if (scale === "small") {
    return { textScale: 0.92, titleScale: 0.94 };
  }
  if (scale === "large") {
    return { textScale: 1.08, titleScale: 1.06 };
  }
  return { textScale: 1, titleScale: 1 };
}

function getThemeTokens(themeName = "meadow", options = {}) {
  const theme = getTheme(themeName);
  const reading = getReadingModeTokens(options.readingMode || "day");
  const font = getFontScaleTokens(options.fontScale || "medium");

  return {
    ...theme,
    navSurface: reading.strongCardTint || "rgba(255, 248, 236, 0.92)",
    cardSurface: reading.cardTint || "rgba(255, 248, 236, 0.88)",
    cardSurfaceStrong: reading.strongCardTint || "rgba(255, 248, 236, 0.96)",
    softBorder: theme.key === "dream" ? "rgba(111, 102, 181, 0.24)" : "rgba(130, 118, 98, 0.14)",
    dashedBorder: theme.key === "dream" ? "rgba(111, 102, 181, 0.34)" : "rgba(130, 118, 98, 0.22)",
    inputText: reading.textBoost || theme.text,
    subtleText: reading.textBoost || theme.text,
    mutedText: reading.mutedBoost || (theme.key === "dream" ? "#7B74B5" : "#8C816F"),
    placeholderText: theme.key === "dream" ? "#A19AD8" : "#B1B8C6",
    inverseText: "#FFFFFF",
    bellOnIcon: theme.primary,
    bellOffIcon: theme.text,
    iconPrimary: theme.primary,
    iconText: theme.text,
    iconMuted: theme.key === "dream" ? "#A19AD8" : "#A8B1BF",
    searchBorder: theme.secondary,
    emptyButtonGradient: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
    bodyBackground: reading.bodyBg || theme.bg,
    readingMode: options.readingMode || "day",
    fontScale: options.fontScale || "medium",
    textScale: font.textScale,
    titleScale: font.titleScale,
    sectionText: reading.textBoost || theme.text,
    sectionStrongText: theme.key === "dream" ? "#2F2B5A" : "#40372E"
  };
}

function applyThemeChrome(themeName = "meadow", options = {}) {
  const theme = getTheme(themeName);
  const tokens = getThemeTokens(themeName, options);

  try {
    wx.setNavigationBarColor({
      frontColor: theme.navFrontColor || "#000000",
      backgroundColor: tokens.cardSurfaceStrong || theme.paper
    });
  } catch (err) {
    console.error("setNavigationBarColor error:", err);
  }

  try {
    wx.setTabBarStyle({
      color: theme.key === "dream" ? "#8176C9" : "#8D836E",
      selectedColor: theme.primary,
      backgroundColor: tokens.cardSurfaceStrong || theme.paper,
      borderStyle: "white"
    });
  } catch (err) {
    console.error("setTabBarStyle error:", err);
  }

  return tokens;
}

module.exports = {
  THEME_MAP,
  normalizeThemeName,
  getTheme,
  getThemeTokens,
  getThemeOptions,
  applyThemeChrome
};