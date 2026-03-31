const { synthesizeTTS, toAbsoluteAudioUrl } = require("./tts");

const SECTION_ORDER = ["lead", "story", "guide"];
const SENTENCE_POLL_INTERVAL = 100;
const SENTENCE_STICKY_SECONDS = 0.16;

const audioMetaCache = new Map();
const pendingAudioMetaCache = new Map();

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
      text,
      timeline: [],
      audioUrl: "",
      duration: 0
    });
  }

  return queue;
}

function buildCacheKey(text = "", voice = "", rate = "") {
  return `${voice}|${rate}|${text}`;
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
    sentenceTimer: null,
    currentSentenceIndex: -1,
    currentTimeline: [],
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

  function clearSentenceTimer() {
    if (state.sentenceTimer) {
      clearInterval(state.sentenceTimer);
      state.sentenceTimer = null;
    }
    state.currentSentenceIndex = -1;
    state.currentTimeline = [];
  }

  function stop() {
    state.token += 1;
    clearSentenceTimer();
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

  function findSentenceIndexByTimeFast(timeline = [], currentTime = 0, lastIndex = -1) {
    if (!Array.isArray(timeline) || !timeline.length) return -1;

    const time = Number(currentTime || 0);
    if (lastIndex >= 0 && lastIndex < timeline.length) {
      const current = timeline[lastIndex];
      const currentStart = Number(current.start || 0);
      const currentEnd = Number(current.end || 0);

      if (time >= currentStart && time < currentEnd) {
        return typeof current.index === "number" ? current.index : lastIndex;
      }

      const next = timeline[lastIndex + 1];
      if (next) {
        const nextStart = Number(next.start || 0);
        const nextEnd = Number(next.end || 0);
        if (time >= nextStart && time < nextEnd) {
          return typeof next.index === "number" ? next.index : lastIndex + 1;
        }
      }
    }

    for (let i = 0; i < timeline.length; i += 1) {
      const item = timeline[i] || {};
      const start = Number(item.start || 0);
      const end = Number(item.end || 0);
      if (time >= start && time < end) {
        return typeof item.index === "number" ? item.index : i;
      }
    }

    if (time >= Number(timeline[timeline.length - 1].end || 0)) {
      const last = timeline[timeline.length - 1];
      return typeof last.index === "number" ? last.index : timeline.length - 1;
    }

    return -1;
  }

  function startSentenceTracking(item, token) {
    clearSentenceTimer();
    state.currentTimeline = Array.isArray(item.timeline) ? item.timeline : [];

    if (!state.currentTimeline.length) {
      emit("onSentenceStart", {
        messageId: item.messageId,
        section: item.section,
        sentenceIndex: -1
      });
      return;
    }

    const tick = () => {
      if (token !== state.token || state.destroyed) return;

      const currentTime = Number(audio.currentTime || 0);
      const nextIndex = findSentenceIndexByTimeFast(
        state.currentTimeline,
        currentTime,
        state.currentSentenceIndex
      );

      if (nextIndex >= 0) {
        if (nextIndex !== state.currentSentenceIndex) {
          state.currentSentenceIndex = nextIndex;
          emit("onSentenceStart", {
            messageId: item.messageId,
            section: item.section,
            sentenceIndex: nextIndex
          });
        }
        return;
      }

      if (state.currentSentenceIndex >= 0) {
        const current = state.currentTimeline[state.currentSentenceIndex];
        if (current) {
          const currentEnd = Number(current.end || 0);
          if (currentTime <= currentEnd + SENTENCE_STICKY_SECONDS) {
            return;
          }
        }
      }
    };

    tick();
    state.sentenceTimer = setInterval(tick, SENTENCE_POLL_INTERVAL);
  }

  function playAudio(item, token) {
    return new Promise((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        clearSentenceTimer();
        audio.offEnded(onEnded);
        audio.offError(onError);
        audio.offStop(onStop);
        audio.offCanplay(onCanPlay);
        audio.offPlay(onPlay);
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
      const onPlay = () => startSentenceTracking(item, token);

      audio.onEnded(onEnded);
      audio.onError(onError);
      audio.onStop(onStop);
      audio.onCanplay(onCanPlay);
      audio.onPlay(onPlay);

      audio.src = item.audioUrl;
    });
  }

  async function fetchAudioMeta(text) {
    const result = await synthesizeTTS({
      text,
      voice: state.voice,
      rate: state.rate
    });

    return {
      audioUrl: toAbsoluteAudioUrl(result.audio_url || result.absolute_audio_url || ""),
      timeline: Array.isArray(result.sentences) ? result.sentences : [],
      duration: Number(result.duration || 0)
    };
  }

  async function ensureAudioForItem(item) {
    const cacheKey = buildCacheKey(item.text, state.voice, state.rate);

    if (audioMetaCache.has(cacheKey)) {
      const cached = audioMetaCache.get(cacheKey);
      item.audioUrl = cached.audioUrl;
      item.timeline = cached.timeline || [];
      item.duration = cached.duration || 0;
      return item;
    }

    if (pendingAudioMetaCache.has(cacheKey)) {
      const cached = await pendingAudioMetaCache.get(cacheKey);
      item.audioUrl = cached.audioUrl;
      item.timeline = cached.timeline || [];
      item.duration = cached.duration || 0;
      return item;
    }

    const pending = fetchAudioMeta(item.text)
      .then((meta) => {
        audioMetaCache.set(cacheKey, meta);
        pendingAudioMetaCache.delete(cacheKey);
        return meta;
      })
      .catch((err) => {
        pendingAudioMetaCache.delete(cacheKey);
        throw err;
      });

    pendingAudioMetaCache.set(cacheKey, pending);
    const meta = await pending;
    item.audioUrl = meta.audioUrl;
    item.timeline = meta.timeline || [];
    item.duration = meta.duration || 0;
    return item;
  }

  function prefetchItem(item) {
    if (!item || !item.text) return Promise.resolve(null);
    return ensureAudioForItem(item).catch((err) => {
      console.warn("tts prefetch failed:", err);
      return null;
    });
  }

  async function playQueue(queue, token) {
    for (let i = 0; i < queue.length; i += 1) {
      const item = queue[i];

      if (token !== state.token || state.destroyed) return;

      const cleanText = normalizePlayText(item.text);
      if (!cleanText) continue;
      item.text = cleanText;

      await ensureAudioForItem(item);

      const nextItem = queue[i + 1];
      if (nextItem) {
        nextItem.text = normalizePlayText(nextItem.text);
        prefetchItem(nextItem);
      }

      if (!item.audioUrl) {
        throw new Error("未获取到可播放的音频地址");
      }

      await playAudio(item, token);
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
      await ensureAudioForItem(queue[0]);
      if (queue[1]) {
        prefetchItem(queue[1]);
      }

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
