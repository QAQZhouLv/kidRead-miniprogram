const { createVoiceStream } = require("../../services/voice_stream");

const recorderManager = wx.getRecorderManager();

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
    }
  },

  data: {
    mode: "text", // text / voice
    inputText: "",
    isRecording: false,
    streamClient: null,

    // 新增
    voiceDraftText: "",     // 当前这一轮语音实时识别
    voiceBaseText: "",      // 开始录音前已有文本
    pressActive: false      // 按钮下沉态
  },

  observers: {
    value(val) {
      if (val !== this.data.inputText) {
        this.setData({ inputText: val || "" });
      }
    }
  },

  lifetimes: {
    attached() {
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
              // 关键：不切回 text，仍保留 voice 模式
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