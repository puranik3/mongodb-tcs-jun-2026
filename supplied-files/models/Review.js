const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    reviewId: {
      type: String,
      required: true,
      unique: true,
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
      required: true,
      index: true
    },

    userRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true
    },

    orderId: {
      type: String,
      index: true
    },

    orderRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order"
    },

    rating: {
      type: Number,
      min: 1,
      max: 5,
      index: true
    },

    title: String,
    body: String,

    status: {
      type: String,
      enum: ["approved", "pending", "rejected"],
      index: true
    },

    verifiedPurchase: {
      type: Boolean,
      index: true
    },

    helpfulVotes: {
      type: Number,
      default: 0
    },

    tags: {
      type: [String],
      index: true
    },

    createdAt: {
      type: Date,
      index: true
    },

    updatedAt: Date
  },
  {
    versionKey: false
  }
);

// Useful training indexes
reviewSchema.index({ productId: 1, createdAt: -1 });
reviewSchema.index({ productId: 1, rating: -1 });
reviewSchema.index({ userId: 1, createdAt: -1 });
reviewSchema.index({ status: 1, rating: -1, createdAt: -1 });
reviewSchema.index({ title: "text", body: "text", tags: "text" });

module.exports = mongoose.model("Review", reviewSchema);