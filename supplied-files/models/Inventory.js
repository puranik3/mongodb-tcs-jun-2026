const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    inventoryId: {
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

    sku: {
      type: String,
      index: true
    },

    category: {
      type: String,
      index: true
    },

    warehouse: {
      warehouseId: {
        type: String,
        required: true,
        index: true
      },
      city: {
        type: String,
        index: true
      },
      state: String,
      country: String
    },

    stock: {
      available: {
        type: Number,
        index: true
      },
      reserved: Number,
      damaged: Number,
      reorderLevel: Number,
      status: {
        type: String,
        enum: ["in_stock", "low_stock", "out_of_stock"],
        index: true
      }
    },

    supplier: {
      name: {
        type: String,
        index: true
      },
      leadTimeDays: Number
    },

    lastRestockedAt: {
      type: Date,
      index: true
    },

    updatedAt: {
      type: Date,
      index: true
    }
  },
  {
    versionKey: false
  }
);

// Useful training indexes
inventorySchema.index({ productId: 1, "warehouse.warehouseId": 1 }, { unique: true });
inventorySchema.index({ "warehouse.city": 1, "stock.status": 1 });
inventorySchema.index({ category: 1, "stock.status": 1 });
inventorySchema.index({ "stock.status": 1, updatedAt: -1 });
db.inventory.createIndex({ "supplier.name": 1, lastRestockedAt: -1 })

module.exports = mongoose.model("Inventory", inventorySchema);