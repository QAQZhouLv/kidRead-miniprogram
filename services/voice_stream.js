const { HTTP_BASE_URL, WS_BASE_URL } = require("../config/index");

function arrayBufferToBase64(buffer) {
  return wx.arrayBufferToBase64(buffer);
}

function createPersistentVoiceStream(onMessage, onError) {
  let socketTask = null;
  let isSocketOpen = false;
  let isConnectionReady = false;
  let isClosed = false;
  let pendingSocketPayloads = [];
  let currentUtteranceId = "";
  let readyUtteranceMap = Object.create(null);
  let pendingUtteranceFrames = Object.create(null);

  function emitMessage(data) {
    if (typeof onMessage === "function") {
      onMessage(data);
    }
  }

  function emitError(err) {
    if (typeof onError === "function") {
      onError(err);
    }
  }

  function resetConnectionState() {
    isSocketOpen = false;
    isConnectionReady = false;
    pendingSocketPayloads = [];
    readyUtteranceMap = Object.create(null);
    pendingUtteranceFrames = Object.create(null);
    currentUtteranceId = "";
  }

  function sendRawPayload(payload) {
    if (isClosed) return;
    if (!socketTask || !isSocketOpen) {
      pendingSocketPayloads.push(payload);
      return;
    }

    socketTask.send({
      data: JSON.stringify(payload),
    });
  }

  function flushSocketPayloads() {
    if (!socketTask || !isSocketOpen || !pendingSocketPayloads.length) {
      return;
    }

    const queue = pendingSocketPayloads.slice();
    pendingSocketPayloads = [];
    queue.forEach((payload) => sendRawPayload(payload));
  }

  function flushUtteranceFrames(utteranceId) {
    if (!utteranceId || !readyUtteranceMap[utteranceId]) {
      return;
    }

    const frames = pendingUtteranceFrames[utteranceId] || [];
    if (!frames.length) {
      return;
    }

    pendingUtteranceFrames[utteranceId] = [];
    frames.forEach((base64Audio) => {
      sendRawPayload({
        type: "audio",
        utterance_id: utteranceId,
        audio_base64: base64Audio,
      });
    });
  }

  function connect() {
    if (socketTask || isClosed) {
      return;
    }

    socketTask = wx.connectSocket({
      url: `${WS_BASE_URL}/ws/asr/stream`,
    });

    socketTask.onOpen(() => {
      isSocketOpen = true;
      sendRawPayload({ type: "start" });
      flushSocketPayloads();
    });

    socketTask.onMessage((res) => {
      try {
        const data = JSON.parse(res.data);

        if (data.type === "ready") {
          isConnectionReady = true;
          flushSocketPayloads();
        }

        if (data.type === "utterance_ready") {
          const utteranceId = data.utterance_id;
          if (utteranceId) {
            readyUtteranceMap[utteranceId] = true;
            flushUtteranceFrames(utteranceId);
          }
        }

        emitMessage(data);
      } catch (e) {
        console.error("voice stream parse error:", e);
      }
    });

    socketTask.onError((err) => {
      emitError(err);
    });

    socketTask.onClose(() => {
      resetConnectionState();
      socketTask = null;
      if (!isClosed) {
        emitError({ errMsg: "voice stream closed" });
      }
    });
  }

  function beginUtterance(options = {}) {
    const utteranceId = options.utteranceId || `utt_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    currentUtteranceId = utteranceId;
    readyUtteranceMap[utteranceId] = false;
    pendingUtteranceFrames[utteranceId] = [];
    connect();
    sendRawPayload({
      type: "begin_utterance",
      utterance_id: utteranceId,
    });
    return utteranceId;
  }

  function sendFrame(arrayBuffer, options = {}) {
    const utteranceId = options.utteranceId || currentUtteranceId;
    if (!utteranceId || !arrayBuffer) {
      return;
    }

    const base64Audio = arrayBufferToBase64(arrayBuffer);

    if (!readyUtteranceMap[utteranceId]) {
      if (!pendingUtteranceFrames[utteranceId]) {
        pendingUtteranceFrames[utteranceId] = [];
      }
      pendingUtteranceFrames[utteranceId].push(base64Audio);
      return;
    }

    sendRawPayload({
      type: "audio",
      utterance_id: utteranceId,
      audio_base64: base64Audio,
    });
  }

  function endUtterance(options = {}) {
    const utteranceId = options.utteranceId || currentUtteranceId;
    if (!utteranceId) {
      return;
    }

    sendRawPayload({
      type: "end_utterance",
      utterance_id: utteranceId,
    });
  }

  function reset() {
    sendRawPayload({ type: "reset" });
    currentUtteranceId = "";
  }

  function ping() {
    sendRawPayload({ type: "ping" });
  }

  function close() {
    isClosed = true;
    currentUtteranceId = "";
    readyUtteranceMap = Object.create(null);
    pendingUtteranceFrames = Object.create(null);

    try {
      if (socketTask) {
        socketTask.close({});
      }
    } catch (e) {}
  }

  connect();

  return {
    connect,
    beginUtterance,
    sendFrame,
    endUtterance,
    reset,
    ping,
    close,
    isConnected() {
      return !!socketTask && isSocketOpen && isConnectionReady;
    },
    getCurrentUtteranceId() {
      return currentUtteranceId;
    },
  };
}

module.exports = {
  createPersistentVoiceStream,
  createVoiceStream: createPersistentVoiceStream,
  HTTP_BASE_URL,
};
