const mongoose = require("mongoose");

const autoBidSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  auction: { type: mongoose.Schema.Types.ObjectId, ref: "Auction", required: true },
  maxAmount: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

// One unique auto-bid per user per auction
autoBidSchema.index({ user: 1, auction: 1 }, { unique: true });

module.exports = mongoose.model("AutoBid", autoBidSchema);
