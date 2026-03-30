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

  methods: {
    onChoiceTap(e) {
      const text = e.currentTarget.dataset.text;
      this.triggerEvent("choicetap", { text });
    },

    onSectionTap(e) {
      const section = e.currentTarget.dataset.section;
      this.triggerEvent("sectiontap", {
        section,
        message: this.data.message,
        ttsEnabled: this.data.ttsEnabled
      });
    }
  }
});
