const { createPersistentVoiceStream } = require("../../services/voice_stream");
const { getThemeTokens } = require("../../utils/theme");

const recorderManager = wx.getRecorderManager();

const PAGE_BG_BY_THEME = {
  meadow: "#ece6c9",
  ocean: "#eae4cc",
  berry: "#f3dfd6",
  sunny: "#f8e8d9",
  citrus: "#f3e0c8",
  lagoon: "#e8e5cf",
};

function normalizeTheme(theme) {
  if (!theme || typeof theme !== "object") {
    return getThemeTokens("meadow");
  }
  return { ...getThemeTokens(theme.key || "meadow"), ...theme };
}

function getPageBgColor(theme) {
  const key = theme && theme.key ? theme.key : "meadow";
  return PAGE_BG_BY_THEME[key] || PAGE_BG_BY_THEME.meadow;
}

function buildStyles(theme) {
  return {
    wrapMaskStyle: `background: ${getPageBgColor(theme)};`,
    inputBarStyle: `background: ${theme.cardSurfaceStrong};`,
    iconBtnStyle: `background: ${theme.paper};`,
    inputStyle: `color: ${theme.inputText};`,
    voiceTextStyle: `color: ${theme.subtleText};`,
    activeVoiceStyle: `background: ${theme.secondary}; box-shadow: inset 0 6rpx 14rpx rgba(0, 0, 0, 0.06);`,
    dotStyle: `background: ${theme.accent};`,
    iconColor: theme.iconText,
  };
}

Component({
  properties: {
    loading: {
      type: Boolean,
      value: false,
    },
    placeholder: {
      type: String,
      value: "发消息或按住说话...",
    },
    value: {
      type: String,
      value: "",
    },
    theme: {
      type: Object,
      value: null,
    },
  },

  data: {
    mode: "text",
    inputText: "",
    isRecording: false,
    streamClient: null,
    voiceDraftText: "",
    voiceBaseText: "",
    currentUtteranceId: "",
    pressActive: false,
    wrapMaskStyle: "",
    inputBarStyle: "",
    iconBtnStyle: "",
    inputStyle: "",
    voiceTextStyle: "",
    activeVoiceStyle: "",
    dotStyle: "",
    iconColor: "#61584b",
  },

  observers: {
    value(val) {
      if (val !== this.data.inputText) {
        this.setData({ inputText: val || "" });
      }
    },

    theme(theme) {
      this.applyTheme(theme);
    },
  },

  lifetimes: {
    attached() {
      this.applyTheme(this.properties.theme);
      this.ensureStreamClient();

      recorderManager.onFrameRecorded((res) => {
        const client = this.data.streamClient;
        const utteranceId = this.data.currentUtteranceId;
        if (!client || !utteranceId || !res.frameBuffer) return;
        client.sendFrame(res.frameBuffer, { utteranceId });
      });

      recorderManager.onError((err) => {
        this.cleanupRecordingState();
        console.error("recorder error:", err);
        wx.showToast({ title: "录音异常", icon: "none" });
      });
    },

    detached() {
      const client = this.data.streamClient;
      if (client) client.close();
    },
  },

  methods: {
    applyTheme(themeInput) {
      const theme = normalizeTheme(themeInput);
      this.setData(buildStyles(theme));
    },

    ensureStreamClient() {
      if (this.data.streamClient) {
        return this.data.streamClient;
      }

      const client = createPersistentVoiceStream(
        (msg) => this.handleVoiceStreamMessage(msg),
        (err) => this.handleVoiceStreamError(err)
      );

      this.setData({ streamClient: client });
      return client;
    },

    handleVoiceStreamMessage(msg) {
      const currentUtteranceId = this.data.currentUtteranceId;
      const msgUtteranceId = msg.utterance_id || "";

      if (msgUtteranceId && currentUtteranceId && msgUtteranceId !== currentUtteranceId) {
        return;
      }

      if (msg.type === "partial" || msg.type === "final" || msg.type === "done") {
        const liveText = (msg.text || "").trim();
        const mergedText = [this.data.voiceBaseText, liveText]
          .filter(Boolean)
          .join(this.data.voiceBaseText && liveText ? " " : "");

        this.setData({
          inputText: mergedText,
          voiceDraftText: liveText,
        });

        this.triggerEvent("draftchange", { text: mergedText });
      }

      if (msg.type === "done") {
        this.cleanupRecordingState();
      }

      if (msg.type === "error") {
        wx.showToast({ title: "语音识别失败", icon: "none" });
        this.cleanupRecordingState();
      }
    },

    handleVoiceStreamError(err) {
      console.error("stream socket error:", err);
      this.cleanupRecordingState();
      wx.showToast({ title: "语音连接失败", icon: "none" });

      const current = this.data.streamClient;
      if (current) {
        try {
          current.close();
        } catch (e) {}
      }
      this.setData({ streamClient: null });
    },

    cleanupRecordingState() {
      this.setData({
        isRecording: false,
        pressActive: false,
        currentUtteranceId: "",
        mode: "voice",
      });
    },

    switchToText() {
      this.setData({ mode: "text" });
    },

    switchToVoice() {
      this.setData({ mode: "voice" });
      this.ensureStreamClient();
    },

    onInput(e) {
      const text = e.detail.value || "";
      this.setData({ inputText: text });
      this.triggerEvent("draftchange", { text });
    },

    onInputFocus() {
      this.triggerEvent("focus");
    },

    onInputBlur() {
      this.triggerEvent("blur");
    },

    onSend() {
      const text = (this.data.inputText || "").trim();
      if (!text || this.properties.loading) return;
      this.triggerEvent("send", { text, inputMode: "text" });
      this.setData({ inputText: "", voiceDraftText: "", voiceBaseText: "" });
    },

    onPressToTalkStart() {
      if (this.properties.loading || this.data.isRecording) return;

      const client = this.ensureStreamClient();
      const currentText = this.data.inputText || "";
      const utteranceId = `utt_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      this.setData({
        isRecording: true,
        pressActive: true,
        voiceBaseText: currentText,
        voiceDraftText: "",
        currentUtteranceId: utteranceId,
      });

      client.beginUtterance({ utteranceId });

      recorderManager.start({
        duration: 60000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 64000,
        format: "pcm",
        frameSize: 5,
      });
    },

    onPressToTalkEnd() {
      if (!this.data.isRecording) return;

      this.setData({ pressActive: false });
      recorderManager.stop();

      const client = this.data.streamClient;
      const utteranceId = this.data.currentUtteranceId;
      if (client && utteranceId) {
        client.endUtterance({ utteranceId });
      }
    },

    onMenuTap() {
      this.triggerEvent("menu");
    },
  },
});
