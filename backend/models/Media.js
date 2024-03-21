const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const MediaSchema = new Schema({
  url: String, // URL to the media
  type: String, // 'image', 'video', etc.
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // ... other fields like thumbnail for videos, etc.
});

const Media = mongoose.model("Media", MediaSchema);
module.exports = Media;
