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

  observers: {
    "playingMessageId, playingSection, playingSentenceIndex": function (playingMessageId, playingSection, playingSentenceIndex) {
      this.handlePlayingSentenceChange(playingMessageId, playingSection, playingSentenceIndex);
    }
  },

  lifetimes: {
    detached() {
      if (this._scrollTimer) {
        clearTimeout(this._scrollTimer);
        this._scrollTimer = null;
      }
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
    },

    handlePlayingSentenceChange(playingMessageId, playingSection, playingSentenceIndex) {
      const message = this.data.message || {};
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

        if (!rect || !viewport) {
          return;
        }

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