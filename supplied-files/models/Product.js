const mongoose = require("mongoose");

const attributeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true }
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    sku: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    name: {
      type: String,
      required: true
    },

    description: String,

    category: {
      type: String,
      required: true,
      index: true
    },

    subcategory: {
      type: String,
      required: true,
      index: true
    },

    brand: {
      type: String,
      required: true,
      index: true
    },

    status: {
      type: String,
      enum: ["active", "inactive", "discontinued"],
      index: true
    },

    price: {
      type: Number,
      required: true,
      index: true
    },

    salePrice: Number,
    discountPercent: Number,

    rating: {
      type: Number,
      index: true
    },

    reviewCount: Number,

    tags: {
      type: [String],
      index: true
    },

    attributes: [attributeSchema],

    stock: {
      available: Number,
      reserved: Number,
      status: {
        type: String,
        enum: ["in_stock", "low_stock", "out_of_stock"],
        index: true
      }
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
productSchema.index({ category: 1, price: 1 });
productSchema.index({ category: 1, rating: -1 });
productSchema.index({ category: 1, subcategory: 1, price: 1 });
productSchema.index({ status: 1, category: 1, price: 1 });
productSchema.index({ "attributes.name": 1, "attributes.value": 1 });
productSchema.index({ name: "text", description: "text", tags: "text" });

module.exports = mongoose.model("Product", productSchema);