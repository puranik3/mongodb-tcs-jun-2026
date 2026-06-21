const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    categoryId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    name: {
      type: String,
      required: true
    },

    slug: {
      type: String,
      required: true,
      index: true
    },

    description: String,

    parentCategoryId: {
      type: String,
      default: null,
      index: true
    },

    level: {
      type: Number,
      enum: [0, 1],
      index: true
    },

    path: {
      type: String,
      required: true,
      index: true
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    displayOrder: Number,

    createdAt: Date,
    updatedAt: Date
  },
  {
    versionKey: false
  }
);

// Useful training indexes
categorySchema.index({ parentCategoryId: 1, displayOrder: 1 });
categorySchema.index({ level: 1, isActive: 1 });

module.exports = mongoose.model("Category", categorySchema);