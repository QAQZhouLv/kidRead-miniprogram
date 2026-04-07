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
    normalizedLead: "",
    normalizedStory: "",
    normalizedGuide: "",
    normalizedChoices: []
  },

  observers: {
    message: function (message) {
      this.normalizeMessage(message);
    }
  },

  lifetimes: {
    attached() {
      this.normalizeMessage(this.properties.message);
    }
  },

  methods: {
    safeTrim(text) {
      return String(text || "")
        .replace(/\r/g, "")
        .replace(/^\s+|\s+$/g, "");
    },

    normalizeMessage(message = {}) {
      const normalizedLead = this.safeTrim(message.lead_text || message.leadText || "");
      const normalizedStory = this.safeTrim(message.story_text || message.storyText || message.text || "");
      const normalizedGuide = this.safeTrim(message.guide_text || message.guideText || "");
      const normalizedChoices = Array.isArray(message.choices)
        ? message.choices.filter(Boolean).map((item) => this.safeTrim(item)).filter(Boolean)
        : [];

      this.setData({
        normalizedLead,
        normalizedStory,
        normalizedGuide,
        normalizedChoices
      });
    },

    onChoiceTap(e) {
      const choice = e.currentTarget.dataset.choice;
      if (!choice) return;

      this.triggerEvent("choicetap", { choice });
    },

    onSectionTap(e) {
      if (!this.properties.ttsEnabled) return;

      const section = e.currentTarget.dataset.section;
      const text = e.currentTarget.dataset.text;

      if (!section || !text) return;

      this.triggerEvent("sectiontap", {
        messageId: this.properties.message.id,
        section,
        text
      });
    },

    isPlaying(section) {
      return (
        this.properties.playingMessageId === this.properties.message.id &&
        this.properties.playingSection === section
      );
    }
  }
});