const mongoose = require("mongoose");

const productEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    eventType: {
      type: String,
      enum: [
        "product_view",
        "search_result_click",
        "add_to_cart",
        "remove_from_cart",
        "wishlist_add",
        "purchase",
        "review_view",
        "price_check",
        "share"
      ],
      index: true
    },

    productId: {
      type: String,
      required: true,
      index: true
    },

    productRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      index: true
    },

    userId: {
      type: String,
      default: null,
      index: true
    },

    userRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    sessionId: {
      type: String,
      index: true
    },

    category: {
      type: String,
      index: true
    },

    channel: {
      type: String,
      enum: ["web", "mobile_app", "marketplace"],
      index: true
    },

    device: {
      type: {
        type: String,
        enum: ["desktop", "mobile", "tablet"],
        index: true
      },
      browser: String,
      os: String
    },

    location: {
      city: { type: String, index: true },
      state: String,
      country: String
    },

    campaign: {
      type: String,
      index: true
    },

    metadata: {
      referrer: String,
      position: Number,
      durationSeconds: Number
    },

    occurredAt: {
      type: Date,
      index: true
    }
  },
  {
    versionKey: false
  }
);

// Useful training indexes
productEventSchema.index({ productId: 1, occurredAt: -1 });
productEventSchema.index({ eventType: 1, occurredAt: -1 });
productEventSchema.index({ category: 1, eventType: 1, occurredAt: -1 });
productEventSchema.index({ userId: 1, occurredAt: -1 });
productEventSchema.index({ sessionId: "hashed" });
productEventSchema.index({ productId: "hashed" });

module.exports = mongoose.model("ProductEvent", productEventSchema);