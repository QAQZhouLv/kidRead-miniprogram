const { splitTextToSentences } = require("../../services/tts_player");

function buildStoryParagraphs(text = "") {
  const normalized = String(text || "")
    .replace(/\r/g, "")
    .trim();

  if (!normalized) return [];

  // 只把“空行”当段落分隔
  const rawParagraphs = normalized
    .split(/\n\s*\n+/)
    .map(item => item.replace(/\n/g, " ").trim())
    .filter(Boolean);

  const paragraphs = rawParagraphs.length ? rawParagraphs : [
    normalized.replace(/\n/g, " ").trim()
  ];

  let globalIndex = 0;

  return paragraphs.map((paragraph) => {
    const sentences = splitTextToSentences(paragraph).map((sentence) => ({
      text: sentence,
      index: globalIndex++
    }));

    return {
      text: paragraph,
      sentences
    };
  });
}

Component({
  properties: {
    message: {
      type: Object,
      value: {}
    },
    ttsEnabled: {
      type: Boolean,
      value: true
    },
    playingMessageId: {
      type: String,
      value: ""
    },
    playingSection: {
      type: String,
      value: ""
    },
    playingSentenceIndex: {
      type: Number,
      value: -1
    }
  },

  data: {
    renderMessage: {},
    normalizedChoices: []
  },

  observers: {
    message(message) {
      this.normalizeMessage(message);
    },
    "playingMessageId, playingSection, playingSentenceIndex": function (
      playingMessageId,
      playingSection,
      playingSentenceIndex
    ) {
      this.handlePlayingSentenceChange(
        playingMessageId,
        playingSection,
        playingSentenceIndex
      );
    }
  },

  lifetimes: {
    attached() {
      this.normalizeMessage(this.properties.message);
    },
    detached() {
      if (this._scrollTimer) {
        clearTimeout(this._scrollTimer);
        this._scrollTimer = null;
      }
    }
  },

  methods: {
    safeTrim(text) {
      return String(text || "")
        .replace(/\r/g, "")
        .replace(/^\s+|\s+$/g, "");
    },

    normalizeMessage(message = {}) {
      const leadText = this.safeTrim(message.lead_text || message.leadText || "");
      const storyText = this.safeTrim(message.story_text || message.storyText || message.text || "");
      const guideText = this.safeTrim(message.guide_text || message.guideText || "");
      const choices = Array.isArray(message.choices)
        ? message.choices.filter(Boolean).map(item => this.safeTrim(item)).filter(Boolean)
        : [];

      const renderMessage = {
        ...message,
        leadText,
        storyText,
        guideText,
        leadSentences: splitTextToSentences(leadText),
        storySentences: splitTextToSentences(storyText),
        storyParagraphs: buildStoryParagraphs(storyText),
        guideSentences: splitTextToSentences(guideText),
        choices
      };

      this.setData({
        renderMessage,
        normalizedChoices: choices
      });
    },

    onChoiceTap(e) {
      const text = e.currentTarget.dataset.text || e.currentTarget.dataset.choice;
      if (!text) return;

      this.triggerEvent("choicetap", {
        text,
        choice: text
      });
    },

    onSectionTap(e) {
      if (!this.properties.ttsEnabled) return;

      const section = e.currentTarget.dataset.section;
      if (!section) return;

      this.triggerEvent("sectiontap", {
        section,
        message: this.data.renderMessage,
        messageId: this.data.renderMessage.id,
        ttsEnabled: this.properties.ttsEnabled
      });
    },

    handlePlayingSentenceChange(playingMessageId, playingSection, playingSentenceIndex) {
      const message = this.data.renderMessage || {};
      if (!message.id) return;
      if (playingMessageId !== message.id) return;
      if (!playingSection || playingSentenceIndex < 0) return;

      const selector = `#sent-${message.id}-${playingSection}-${playingSentenceIndex}`;

      if (this._scrollTimer) {
        clearTimeout(this._scrollTimer);
      }

      this._scrollTimer = setTimeout(() => {
        this.scrollSentenceIntoView(selector);
      }, 60);
    },

    scrollSentenceIntoView(selector) {
      const query = this.createSelectorQuery();
      query.select(selector).boundingClientRect();
      query.selectViewport().scrollOffset();
      query.exec((res) => {
        const rect = res && res[0];
        const viewport = res && res[1];

        if (!rect || !viewport) return;

        const scrollTop = Number(viewport.scrollTop || 0);
        const targetTop = Math.max(scrollTop + rect.top - 180, 0);

        wx.pageScrollTo({
          scrollTop: targetTop,
          duration: 220
        });
      });
    }
  }
});