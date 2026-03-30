const { HTTP_BASE_URL, WS_BASE_URL } = require("../config/index");

function arrayBufferToBase64(buffer) {
  return wx.arrayBufferToBase64(buffer);
}

function createVoiceStream(onMessage, onError) {
  let isReady = false;
  let pendingFrames = [];

  const socketTask = wx.connectSocket({
    url: `${WS_BASE_URL}/ws/asr/stream`
  });

  socketTask.onOpen(() => {
    socketTask.send({
      data: JSON.stringify({ type: "start" })
    });
  });

  socketTask.onMessage((res) => {
    try {
      const data = JSON.parse(res.data);

      if (data.type === "ready") {
        isReady = true;

        pendingFrames.forEach((buffer) => {
          socketTask.send({
            data: JSON.stringify({
              type: "audio",
              audio_base64: arrayBufferToBase64(buffer)
            })
          });
        });
        pendingFrames = [];
      }

      onMessage && onMessage(data);
    } catch (e) {
      console.error("voice stream parse error:", e);
    }
  });

  socketTask.onError((err) => {
    onError && onError(err);
  });

  return {
    sendFrame(arrayBuffer) {
      if (!isReady) {
        pendingFrames.push(arrayBuffer);
        return;
      }

      socketTask.send({
        data: JSON.stringify({
          type: "audio",
          audio_base64: arrayBufferToBase64(arrayBuffer)
        })
      });
    },

    stop() {
      socketTask.send({
        data: JSON.stringify({ type: "stop" })
      });
    },

    close() {
      try {
        socketTask.close({});
      } catch (e) {}
    }
  };
}

module.exports = {
  createVoiceStream,
  HTTP_BASE_URL
};