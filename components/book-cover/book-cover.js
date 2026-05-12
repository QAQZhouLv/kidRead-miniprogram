Component({
  properties: {
    title: {
      type: String,
      value: "未命名故事"
    },
    imageUrl: {
      type: String,
      value: ""
    },
    coverStatus: {
      type: String,
      value: ""
    },
    size: {
      type: String,
      value: "medium" // small | medium | large
    },
    themeIndex: {
      type: Number,
      value: 0
    }
  },

  data: {
    imageFailed: false
  },

  observers: {
    imageUrl(newVal) {
      if (String(newVal || "").trim()) {
        this.setData({ imageFailed: false });
      }
    }
  },

  methods: {
    onImageError(e) {
      console.warn("book-cover image load failed:", {
        imageUrl: this.data.imageUrl,
        err: e && e.detail
      });
      this.setData({ imageFailed: true });
    }
  }
});