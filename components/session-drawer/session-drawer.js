Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: "历史会话"
    },
    sessions: {
      type: Array,
      value: []
    },
    currentSessionId: {
      type: String,
      value: ""
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
      this.triggerEvent("selectsession", { sessionId });
    },

    onDeleteTap(e) {
      const sessionId = e.currentTarget.dataset.sessionid;
      this.triggerEvent("deletesession", { sessionId });
    },

    onSessionLongPress(e) {
      const sessionId = e.currentTarget.dataset.sessionid;
      const title = e.currentTarget.dataset.title || "";
      this.triggerEvent("longpresssession", { sessionId, title });
    }
  }
});