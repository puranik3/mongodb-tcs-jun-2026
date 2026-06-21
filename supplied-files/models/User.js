const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    name: {
      first: { type: String, required: true },
      last: { type: String, required: true },
      full: { type: String, required: true }
    },

    email: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    phone: String,

    status: {
      type: String,
      enum: ["active", "inactive", "blocked"],
      index: true
    },

    segment: {
      type: String,
      enum: ["regular", "premium", "enterprise"],
      index: true
    },

    marketingSource: {
      type: String,
      enum: ["google", "facebook", "instagram", "referral", "organic", "email_campaign"]
    },

    createdAt: {
      type: Date,
      index: true
    },

    lastLoginAt: Date,

    address: {
      city: { type: String, index: true },
      state: String,
      country: String,
      pincode: String
    },

    loyaltyPoints: {
      type: Number,
      index: true
    },

    preferences: {
      newsletter: Boolean,
      smsAlerts: Boolean,
      preferredCategory: String
    }
  },
  {
    versionKey: false
  }
);

// Useful indexes
userSchema.index({ status: 1, createdAt: -1 });
userSchema.index({ "address.city": 1, segment: 1 });
userSchema.index({ segment: 1, loyaltyPoints: -1 });
userSchema.index({ "name.full": "text", email: "text" });

module.exports = mongoose.model("User", userSchema);