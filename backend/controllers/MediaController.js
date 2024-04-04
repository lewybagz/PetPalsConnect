const Media = require("../models/Media"); // Adjust the path to your Media model

// Fetch media details by ID
exports.getMediaDetails = async (req, res) => {
  try {
    const mediaId = req.params.id;
    const media = await Media.findById(mediaId);
    if (!media) {
      return res.status(404).json({ message: "Media not found" });
    }
    res.json(media);
  } catch (error) {
    console.error("Error fetching media details:", error);
    res.status(500).json({ message: "Server error" });
  }
};
