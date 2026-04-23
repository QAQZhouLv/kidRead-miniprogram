
const { synthesizeTTS, prepareTTSMessage, toAbsoluteAudioUrl } = require("./tts");

const SENTENCE_STICKY_SECONDS = 0.18;
const SENTENCE_POLL_INTERVAL = 120;
const DEFAULT_SEGMENT_CHAR_LIMIT = 90;
const DEFAULT_MAX_SENTENCES_PER_SEGMENT = 3;
const DEFAULT_PREFETCH_COUNT = 2;

const SENTENCE_RE = /[^。！？!?；;\n]+[。！？!?；;\n]?/g;

function splitTextToSentences(text) {
  const normalized = String(text || "").replace(/\r/g, "").trim();
  if (!normalized) return [];
  const parts = normalized.match(SENTENCE_RE);
  if (!parts || !parts.length) return [normalized];
  return parts.map((item) => String(item || "").trim()).filter(Boolean);
}

function normalizePlayText(text) {
  return String(text || "").replace(/\r/g, "").trim();
}

function buildMessageCacheKey(message, voice, rate, segmentCharLimit, maxSentencesPerSegment) {
  const lead = normalizePlayText(message.leadText || message.lead_text || "");
  const story = normalizePlayText(message.storyText || message.story_text || "");
  const guide = normalizePlayText(message.guideText || message.guide_text || "");
  return [
    voice,
    rate,
    segmentCharLimit,
    maxSentencesPerSegment,
    lead,
    story,
    guide
  ].join("|");
}

function buildAudioCacheKey(text, voice, rate) {
  return `${voice}|${rate}|${normalizePlayText(text)}`;
}

function buildFallbackSectionSegments(section, text) {
  const cleanText = normalizePlayText(text);
  if (!cleanText) return [];
  const sentences = splitTextToSentences(cleanText);
  const segments = [];
  let current = [];
  let currentLength = 0;
  let startSentenceIndex = 0;

  for (let i = 0; i < sentences.length; i += 1) {
    const sentence = sentences[i];
    const nextLen = currentLength + sentence.length;
    if (current.length && (current.length >= DEFAULT_MAX_SENTENCES_PER_SEGMENT || nextLen > DEFAULT_SEGMENT_CHAR_LIMIT)) {
      segments.push({
        section,
        segmentId: `${section}_${segments.length}`,
        text: current.join("").trim(),
        startSentenceIndex,
        endSentenceIndex: startSentenceIndex + current.length - 1
      });
      current = [];
      currentLength = 0;
      startSentenceIndex = i;
    }
    if (!current.length) startSentenceIndex = i;
    current.push(sentence);
    currentLength += sentence.length;
  }

  if (current.length) {
    segments.push({
      section,
      segmentId: `${section}_${segments.length}`,
      text: current.join("").trim(),
      startSentenceIndex,
      endSentenceIndex: startSentenceIndex + current.length - 1
    });
  }

  return segments;
}

function buildPlayQueue(message, startSection = "lead", manifest) {
  const order = ["lead", "story", "guide"];
  const startIndex = Math.max(order.indexOf(startSection || "lead"), 0);
  const queue = [];

  if (manifest && Array.isArray(manifest.sections) && manifest.sections.length) {
    const sectionMap = new Map();
    manifest.sections.forEach((sectionInfo) => {
      sectionMap.set(sectionInfo.section, sectionInfo);
    });

    for (let i = startIndex; i < order.length; i += 1) {
      const section = order[i];
      const sectionInfo = sectionMap.get(section);
      if (!sectionInfo || !Array.isArray(sectionInfo.segments)) continue;
      sectionInfo.segments.forEach((segment) => {
        queue.push({
          messageId: message.id,
          section,
          segmentId: segment.segment_id || `${section}_${segment.segment_index || 0}`,
          text: normalizePlayText(segment.text || ""),
          startSentenceIndex: Number(segment.start_sentence_index || 0),
          endSentenceIndex: Number(segment.end_sentence_index || 0),
          audioUrl: "",
          duration: 0,
          timeline: []
        });
      });
    }
    return queue.filter((item) => item.text);
  }

  for (let i = startIndex; i < order.length; i += 1) {
    const section = order[i];
    const text = message[`${section}Text`] || message[`${section}_text`] || "";
    buildFallbackSectionSegments(section, text).forEach((segment) => {
      queue.push({
        messageId: message.id,
        section,
        segmentId: segment.segmentId,
        text: segment.text,
        startSentenceIndex: segment.startSentenceIndex,
        endSentenceIndex: segment.endSentenceIndex,
        audioUrl: "",
        duration: 0,
        timeline: []
      });
    });
  }

  return queue;
}

function createTTSPlayer(options = {}) {
  const audio = wx.createInnerAudioContext();
  audio.obeyMuteSwitch = false;
  audio.autoplay = false;

  const messageManifestCache = new Map();
  const pendingManifestCache = new Map();
  const audioMetaCache = new Map();
  const pendingAudioMetaCache = new Map();

  const state = {
    destroyed: false,
    token: 0,
    voice: options.voice || "zh-CN-XiaoxiaoNeural",
    rate: options.rate || "+0%",
    segmentCharLimit: Number(options.segmentCharLimit || DEFAULT_SEGMENT_CHAR_LIMIT),
    maxSentencesPerSegment: Number(options.maxSentencesPerSegment || DEFAULT_MAX_SENTENCES_PER_SEGMENT),
    prefetchCount: Number(options.prefetchCount || DEFAULT_PREFETCH_COUNT),
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
    } catch (err) {}
    emit("onPlayStateChange", { playing: false });
  }

  function destroy() {
    if (state.destroyed) return;
    stop();
    state.destroyed = true;
    try {
      audio.destroy();
    } catch (err) {}
  }

  function mapTimelineToGlobal(item, timeline) {
    if (!Array.isArray(timeline)) return [];
    const base = Number(item.startSentenceIndex || 0);
    return timeline.map((entry, idx) => ({
      index: base + (typeof entry.index === "number" ? entry.index : idx),
      text: entry.text || "",
      start: Number(entry.start || 0),
      end: Number(entry.end || 0)
    }));
  }

  function findSentenceIndexByTimeFast(timeline, currentTime, previousIndex) {
    if (!Array.isArray(timeline) || !timeline.length) return -1;
    if (previousIndex >= 0 && previousIndex < timeline.length) {
      const current = timeline[previousIndex];
      if (current && current.start <= currentTime && currentTime <= current.end + SENTENCE_STICKY_SECONDS) {
        return previousIndex;
      }
    }
    for (let i = 0; i < timeline.length; i += 1) {
      const item = timeline[i];
      if (!item) continue;
      if (item.start <= currentTime && currentTime <= item.end + SENTENCE_STICKY_SECONDS) {
        return i;
      }
    }
    if (currentTime > Number(timeline[timeline.length - 1].end || 0)) {
      return timeline.length - 1;
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
        sentenceIndex: Number(item.startSentenceIndex || -1)
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
          const current = state.currentTimeline[nextIndex];
          emit("onSentenceStart", {
            messageId: item.messageId,
            section: item.section,
            sentenceIndex: typeof current.index === "number" ? current.index : nextIndex
          });
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
    const cacheKey = buildAudioCacheKey(item.text, state.voice, state.rate);
    if (audioMetaCache.has(cacheKey)) {
      const cached = audioMetaCache.get(cacheKey);
      item.audioUrl = cached.audioUrl;
      item.timeline = mapTimelineToGlobal(item, cached.timeline || []);
      item.duration = cached.duration || 0;
      return item;
    }

    if (!pendingAudioMetaCache.has(cacheKey)) {
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
    }

    const meta = await pendingAudioMetaCache.get(cacheKey);
    item.audioUrl = meta.audioUrl;
    item.timeline = mapTimelineToGlobal(item, meta.timeline || []);
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

  async function fetchMessageManifest(message) {
    const payload = {
      lead_text: normalizePlayText(message.leadText || message.lead_text || ""),
      story_text: normalizePlayText(message.storyText || message.story_text || ""),
      guide_text: normalizePlayText(message.guideText || message.guide_text || ""),
      voice: state.voice,
      rate: state.rate,
      segment_char_limit: state.segmentCharLimit,
      max_sentences_per_segment: state.maxSentencesPerSegment
    };
    return prepareTTSMessage(payload);
  }

  async function ensureMessageManifest(message) {
    const cacheKey = buildMessageCacheKey(
      message,
      state.voice,
      state.rate,
      state.segmentCharLimit,
      state.maxSentencesPerSegment
    );

    if (messageManifestCache.has(cacheKey)) {
      return messageManifestCache.get(cacheKey);
    }

    if (!pendingManifestCache.has(cacheKey)) {
      const pending = fetchMessageManifest(message)
        .then((manifest) => {
          messageManifestCache.set(cacheKey, manifest);
          pendingManifestCache.delete(cacheKey);
          return manifest;
        })
        .catch((err) => {
          pendingManifestCache.delete(cacheKey);
          console.warn("tts prepare-message failed, fallback to local split:", err);
          const fallbackManifest = null;
          messageManifestCache.set(cacheKey, fallbackManifest);
          return fallbackManifest;
        });
      pendingManifestCache.set(cacheKey, pending);
    }

    return pendingManifestCache.get(cacheKey);
  }

  async function preloadMessage(message, startSection = "lead") {
    if (state.destroyed) return null;
    const manifest = await ensureMessageManifest(message);
    const queue = buildPlayQueue(message, startSection, manifest);
    if (!queue.length) return null;

    await ensureAudioForItem(queue[0]);
    for (let i = 1; i <= state.prefetchCount; i += 1) {
      const nextItem = queue[i];
      if (nextItem) prefetchItem(nextItem);
    }
    return queue[0];
  }

  async function playQueue(queue, token) {
    for (let i = 0; i < queue.length; i += 1) {
      const item = queue[i];
      if (token !== state.token || state.destroyed) return;

      item.text = normalizePlayText(item.text);
      if (!item.text) continue;

      await ensureAudioForItem(item);

      for (let j = 1; j <= state.prefetchCount; j += 1) {
        const nextItem = queue[i + j];
        if (nextItem) {
          nextItem.text = normalizePlayText(nextItem.text);
          prefetchItem(nextItem);
        }
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

    const manifest = await ensureMessageManifest(message);
    const queue = buildPlayQueue(message, startSection, manifest);
    if (!queue.length) {
      emit("onFinish", { reason: "empty" });
      return;
    }

    emit("onPlayStateChange", { playing: true });
    try {
      await ensureAudioForItem(queue[0]);
      for (let i = 1; i <= state.prefetchCount; i += 1) {
        if (queue[i]) prefetchItem(queue[i]);
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
      throw err;
    }
  }

  return {
    setCallbacks,
    playMessage,
    preloadMessage,
    stop,
    destroy,
    splitTextToSentences,
    buildPlayQueue: (message, startSection = "lead") => {
      const cacheKey = buildMessageCacheKey(
        message,
        state.voice,
        state.rate,
        state.segmentCharLimit,
        state.maxSentencesPerSegment
      );
      return buildPlayQueue(message, startSection, messageManifestCache.get(cacheKey));
    }
  };
}

module.exports = {
  createTTSPlayer,
  splitTextToSentences,
  buildPlayQueue
};
