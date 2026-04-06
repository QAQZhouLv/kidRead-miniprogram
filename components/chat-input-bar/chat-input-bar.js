const { createVoiceStream } = require("../../services/voice_stream");
const { getThemeTokens } = require("../../utils/theme");

const recorderManager = wx.getRecorderManager();

function normalizeTheme(theme) {
  if (!theme || typeof theme !== "object") {
    return getThemeTokens("meadow");
  }
  return {
    ...getThemeTokens(theme.key || "meadow"),
    ...theme
  };
}

function buildStyles(theme) {
  return {
    inputBarStyle: `background: ${theme.cardSurfaceStrong};`,
    iconBtnStyle: `background: ${theme.paper};`,
    inputStyle: `color: ${theme.inputText};`,
    voiceTextStyle: `color: ${theme.subtleText};`,
    activeVoiceStyle: `background: ${theme.secondary}; box-shadow: inset 0 6rpx 14rpx rgba(0, 0, 0, 0.06);`,
    dotStyle: `background: ${theme.accent};`,
    iconColor: theme.iconText
  };
}

Component({
  properties: {
    loading: {
      type: Boolean,
      value: false
    },
    placeholder: {
      type: String,
      value: "发消息或按住说话..."
    },
    value: {
      type: String,
      value: ""
    },
    theme: {
      type: Object,
      value: null
    }
  },

  data: {
    mode: "text",
    inputText: "",
    isRecording: false,
    streamClient: null,
    voiceDraftText: "",
    voiceBaseText: "",
    pressActive: false,
    inputBarStyle: "",
    iconBtnStyle: "",
    inputStyle: "",
    voiceTextStyle: "",
    activeVoiceStyle: "",
    dotStyle: "",
    iconColor: "#61584b"
  },

  observers: {
    value(val) {
      if (val !== this.data.inputText) {
        this.setData({ inputText: val || "" });
      }
    },
    theme(theme) {
      this.applyTheme(theme);
    }
  },

  lifetimes: {
    attached() {
      this.applyTheme(this.properties.theme);

      recorderManager.onFrameRecorded((res) => {
        if (!this.data.streamClient || !res.frameBuffer) return;
        this.data.streamClient.sendFrame(res.frameBuffer);
      });

      recorderManager.onError((err) => {
        this.setData({
          isRecording: false,
          pressActive: false
        });
        console.error("recorder error:", err);
        wx.showToast({
          title: "录音异常",
          icon: "none"
        });
      });
    },

    detached() {
      const client = this.data.streamClient;
      if (client) client.close();
    }
  },

  methods: {
    applyTheme(themeInput) {
      const theme = normalizeTheme(themeInput);
      this.setData(buildStyles(theme));
    },

    switchToText() {
      this.setData({ mode: "text" });
    },

    switchToVoice() {
      this.setData({ mode: "voice" });
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

      this.triggerEvent("send", {
        text,
        inputMode: "text"
      });

      this.setData({
        inputText: "",
        voiceDraftText: "",
        voiceBaseText: ""
      });
    },

    onPressToTalkStart() {
      if (this.properties.loading || this.data.isRecording) return;

      const currentText = this.data.inputText || "";

      const streamClient = createVoiceStream(
        (msg) => {
          if (msg.type === "partial" || msg.type === "final" || msg.type === "done") {
            const liveText = (msg.text || "").trim();

            const mergedText = [this.data.voiceBaseText, liveText]
              .filter(Boolean)
              .join(this.data.voiceBaseText && liveText ? " " : "");

            this.setData({
              inputText: mergedText,
              voiceDraftText: liveText
            });

            this.triggerEvent("draftchange", { text: mergedText });
          }

          if (msg.type === "done") {
            this.setData({
              isRecording: false,
              pressActive: false,
              mode: "voice"
            });
          }

          if (msg.type === "error") {
            wx.showToast({
              title: "语音识别失败",
              icon: "none"
            });
          }
        },
        (err) => {
          console.error("stream socket error:", err);
          this.setData({
            isRecording: false,
            pressActive: false
          });
          wx.showToast({
            title: "语音连接失败",
            icon: "none"
          });
        }
      );

      this.setData({
        isRecording: true,
        pressActive: true,
        streamClient,
        voiceBaseText: currentText,
        voiceDraftText: ""
      });

      recorderManager.start({
        duration: 60000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 64000,
        format: "pcm",
        frameSize: 5
      });
    },

    onPressToTalkEnd() {
      if (!this.data.isRecording) return;

      this.setData({
        pressActive: false
      });

      recorderManager.stop();

      const client = this.data.streamClient;
      if (client) {
        client.stop();
      }
    },

    onMenuTap() {
      this.triggerEvent("menu");
    }
  }
});
