Component({
  properties: {
    visible: Boolean,
    title: String,
    sessions: {
      type: Array,
      value: []
    },
    currentSessionId: String,
    offsetTop: {
      type: Number,
      value: 0
    }
  },

  data: {
    pinnedSessions: [],
    normalSessions: []
  },

  observers: {
    sessions(list) {
      const rows = Array.isArray(list) ? list : [];
      this.setData({
        pinnedSessions: rows.filter(item => !!item.is_pinned),
        normalSessions: rows.filter(item => !item.is_pinned)
      });
    }
  },

  methods: {
    onMaskTap() {
      this.triggerEvent("close");
    },

    onNewTap() {
      this.triggerEvent("newsession");
    },

    onSessionTap(e) {
      const sessionId = e.currentTarget.dataset.sessionid;
      if (!sessionId) return;
      this.triggerEvent("selectsession", { sessionId });
    },

    onMoreTap(e) {
      const session = e.currentTarget.dataset.session;
      this.triggerEvent("moresession", { session });
    }
  }
});