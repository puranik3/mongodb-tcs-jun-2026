const mongoose = require("mongoose");

const supportTicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    userId: { type: String, required: true, index: true },
    userRef: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },

    productId: { type: String, index: true },
    productRef: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },

    orderId: { type: String, index: true },
    orderRef: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },

    status: {
      type: String,
      enum: ["open", "in_progress", "waiting_for_customer", "resolved", "closed"],
      index: true
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      index: true
    },

    channel: {
      type: String,
      enum: ["email", "chat", "phone", "web_form", "mobile_app"],
      index: true
    },

    issueType: {
      type: String,
      index: true
    },

    department: {
      type: String,
      index: true
    },

    assignedAgent: {
      type: String,
      index: true
    },

    subject: String,
    description: String,

    tags: {
      type: [String],
      index: true
    },

    sla: {
      firstResponseMinutes: Number,
      resolutionHours: Number,
      breached: {
        type: Boolean,
        index: true
      }
    },

    customerSatisfaction: Number,

    createdAt: {
      type: Date,
      index: true
    },

    updatedAt: Date,

    resolvedAt: {
      type: Date,
      default: null,
      index: true
    }
  },
  {
    versionKey: false
  }
);

// Useful training indexes
supportTicketSchema.index({ status: 1, createdAt: -1 });
supportTicketSchema.index({ priority: 1, status: 1, createdAt: -1 });
supportTicketSchema.index({ issueType: 1, status: 1 });
supportTicketSchema.index({ assignedAgent: 1, status: 1 });
supportTicketSchema.index({ "sla.breached": 1, priority: 1 });
supportTicketSchema.index({ subject: "text", description: "text", tags: "text" });

module.exports = mongoose.model("SupportTicket", supportTicketSchema);