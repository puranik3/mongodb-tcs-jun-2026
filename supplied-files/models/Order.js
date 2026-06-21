const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      index: true
    },

    productRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product"
    },

    sku: String,

    category: {
      type: String,
      index: true
    },

    nameSnapshot: String,

    unitPrice: Number,
    quantity: Number,
    lineTotal: Number
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
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

    status: {
      type: String,
      enum: [
        "placed",
        "paid",
        "packed",
        "shipped",
        "delivered",
        "cancelled",
        "returned"
      ],
      index: true
    },

    channel: {
      type: String,
      enum: ["web", "mobile_app", "marketplace"],
      index: true
    },

    payment: {
      method: {
        type: String,
        enum: ["upi", "credit_card", "debit_card", "net_banking", "wallet", "cod"],
        index: true
      },

      status: {
        type: String,
        enum: ["pending", "failed", "paid"],
        index: true
      },

      transactionId: String
    },

    shippingAddress: {
      city: {
        type: String,
        index: true
      },
      state: String,
      country: String,
      pincode: String
    },

    items: [orderItemSchema],

    itemCount: Number,

    subtotal: Number,
    discount: Number,
    shippingFee: Number,
    tax: Number,

    totalAmount: {
      type: Number,
      index: true
    },

    createdAt: {
      type: Date,
      index: true
    },

    deliveredAt: {
      type: Date,
      default: null
    }
  },
  {
    versionKey: false
  }
);

// Useful training indexes
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ status: 1, totalAmount: -1 });
orderSchema.index({ "shippingAddress.city": 1, status: 1 });
orderSchema.index({ "items.productId": 1 });
orderSchema.index({ "items.category": 1, createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);