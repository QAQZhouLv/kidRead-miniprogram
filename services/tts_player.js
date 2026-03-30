const { synthesizeTTS, toAbsoluteAudioUrl } = require("./tts");

const SECTION_ORDER = ["lead", "story", "guide"];

function splitTextToSentences(text = "") {
  const normalized = String(text || "")
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

  if (!normalized) return [];

  const parts = normalized.match(/[^。！？!?；;\n]+[。！？!?；;\n]?/g) || [normalized];
  return parts.map(item => item.trim()).filter(Boolean);
}

function normalizePlayText(text = "") {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPlayQueue(message = {}, startSection = "lead") {
  const startIndex = Math.max(SECTION_ORDER.indexOf(startSection), 0);
  const queue = [];

  for (let i = startIndex; i < SECTION_ORDER.length; i += 1) {
    const section = SECTION_ORDER[i];
    const field =
      section === "lead"
        ? "leadText"
        : section === "story"
          ? "storyText"
          : "guideText";

    const text = normalizePlayText(message[field] || "");
    if (!text) continue;

    queue.push({
      messageId: message.id,
      section,
      sentenceIndex: -1,
      text
    });
  }

  return queue;
}

function createTTSPlayer(options = {}) {
  const audio = wx.createInnerAudioContext();
  audio.obeyMuteSwitch = false;
  audio.autoplay = false;

  const state = {
    destroyed: false,
    token: 0,
    voice: options.voice || "zh-CN-XiaoxiaoNeural",
    rate: options.rate || "+0%",
    callbacks: {
      onSentenceStart: null,
      onPlayStateChange: null,
      onFinish: null,
      onError: null
    }
  };

  function emit(name, payload) {
    const fn = state.callbacks[name];
    if (typeof fn === "function") {
      fn(payload);
    }
  }

  function setCallbacks(callbacks = {}) {
    state.callbacks = {
      ...state.callbacks,
      ...callbacks
    };
  }

  function stop() {
    state.token += 1;
    try {
      audio.stop();
    } catch (err) {
      console.error("tts stop error:", err);
    }
    emit("onPlayStateChange", { playing: false });
  }

  function destroy() {
    if (state.destroyed) return;
    stop();
    state.destroyed = true;
    try {
      audio.destroy();
    } catch (err) {
      console.error("tts destroy error:", err);
    }
  }

  function playAudio(src, token) {
    return new Promise((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        audio.offEnded(onEnded);
        audio.offError(onError);
        audio.offStop(onStop);
        audio.offCanplay(onCanPlay);
      };

      const finish = (handler, payload) => {
        if (settled) return;
        settled = true;
        cleanup();
        handler(payload);
      };

      const onEnded = () => finish(resolve);
      const onError = (err) => finish(reject, err);
      const onStop = () => finish(resolve);
      const onCanPlay = () => {
        if (token !== state.token || state.destroyed) {
          finish(resolve);
          return;
        }
        try {
          audio.play();
        } catch (err) {
          finish(reject, err);
        }
      };

      audio.onEnded(onEnded);
      audio.onError(onError);
      audio.onStop(onStop);
      audio.onCanplay(onCanPlay);

      audio.src = src;
    });
  }

  async function playQueue(queue, token) {
    for (let i = 0; i < queue.length; i += 1) {
      const item = queue[i];

      if (token !== state.token || state.destroyed) return;

      emit("onSentenceStart", item);

      const cleanText = normalizePlayText(item.text);
      if (!cleanText) continue;

      const result = await synthesizeTTS({
        text: cleanText,
        voice: state.voice,
        rate: state.rate
      });

      const src = toAbsoluteAudioUrl(result.audio_url);
      await playAudio(src, token);
    }
  }

  async function playMessage(message, startSection = "lead") {
    if (state.destroyed) return;

    stop();
    const token = state.token;
    const queue = buildPlayQueue(message, startSection);

    if (!queue.length) {
      emit("onFinish", { reason: "empty" });
      return;
    }

    emit("onPlayStateChange", { playing: true });

    try {
      await playQueue(queue, token);

      if (token === state.token && !state.destroyed) {
        emit("onPlayStateChange", { playing: false });
        emit("onFinish", { reason: "ended" });
      }
    } catch (err) {
      console.error("tts playMessage error:", err);
      emit("onPlayStateChange", { playing: false });
      emit("onError", err);
    }
  }

  return {
    setCallbacks,
    playMessage,
    stop,
    destroy,
    splitTextToSentences,
    buildPlayQueue
  };
}

module.exports = {
  createTTSPlayer,
  splitTextToSentences,
  buildPlayQueue
};