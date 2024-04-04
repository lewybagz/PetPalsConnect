const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const MediaSchema = new Schema({
  url: {
    type: String, // URL to the media
    required: true,
  },
  type: {
    type: String, // 'image', 'video', etc.
    required: true,
  },
  thumbnail: {
    type: String, // URL to the thumbnail, mainly for videos
    required: function () {
      return this.type === "video";
    }, // Conditional requirement based on media type
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Media = mongoose.model("Media", MediaSchema);
module.exports = Media;
