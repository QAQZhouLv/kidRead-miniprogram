const { WS_BASE_URL } = require("../config/index");

function createChatStream(onMessage, onError) {
  let socketTask = null;
  let isOpen = false;
  let isClosed = false;
  let openPromiseResolve = null;
  let openPromiseReject = null;

  const openPromise = new Promise((resolve, reject) => {
    openPromiseResolve = resolve;
    openPromiseReject = reject;
  });

  const initPromise = (async () => {
    const app = getApp();
    if (app && typeof app.ensureLogin === "function") {
      await app.ensureLogin();
    }
    const token = app && app.getAuthToken ? app.getAuthToken() : "";
    const url = token
      ? `${WS_BASE_URL}/ws/chat/stream?token=${encodeURIComponent(token)}`
      : `${WS_BASE_URL}/ws/chat/stream`;

    socketTask = wx.connectSocket({ url });

    socketTask.onOpen(() => {
      isOpen = true;
      if (openPromiseResolve) openPromiseResolve();
    });

    socketTask.onMessage((res) => {
      try {
        const data = JSON.parse(res.data);
        onMessage && onMessage(data);
      } catch (e) {
        console.error("chat stream parse error:", e);
      }
    });

    socketTask.onError((err) => {
      if (!isOpen && openPromiseReject) {
        openPromiseReject(err);
      }
      onError && onError(err);
    });

    socketTask.onClose(() => {
      isOpen = false;
      isClosed = true;
    });

    return openPromise;
  })();

  return {
    async send(payload) {
      if (isClosed) {
        throw new Error("socket already closed");
      }

      await initPromise;
      if (!isOpen) {
        await openPromise;
      }

      return new Promise((resolve, reject) => {
        socketTask.send({
          data: JSON.stringify(payload),
          success: resolve,
          fail: reject
        });
      });
    },

    close() {
      if (isClosed) return;
      try {
        if (socketTask) {
          socketTask.close({});
        }
      } catch (e) {
        console.error("socket close error:", e);
      }
    }
  };
}

module.exports = {
  createChatStream
};
