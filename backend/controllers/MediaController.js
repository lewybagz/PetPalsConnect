const Media = require("../models/Media");
const Chat = require("../models/Chat");
const GroupChat = require("../models/GroupChat");

/**
 * One shared file, by id.
 *
 * Media is what people send each other in a chat, and this returned any of it
 * to anybody with an id: `Media.findById(mediaId)` and nothing else. The file
 * itself sits behind Firebase Storage rules, but the record is the map to it,
 * and enumerating ids is not hard.
 *
 * A piece of media is readable if it is in a conversation the caller is in.
 */
exports.getMediaDetails = async (req, res) => {
  try {
    const mediaId = req.params.id;
    const media = await Media.findById(mediaId);
    if (!media) {
      return res.status(404).json({ message: "Media not found" });
    }

    const [inChat, inGroup] = await Promise.all([
      Chat.exists({ media: media._id, participants: req.userId }),
      GroupChat.exists({ media: media._id, participants: req.userId }),
    ]);

    // Uploads keep their uploader, so a file you sent is yours to fetch even
    // if the conversation has since been deleted.
    const mine = String(media.createdBy) === String(req.userId);

    if (!inChat && !inGroup && !mine) {
      return res.status(404).json({ message: "Media not found" });
    }

    res.json(media);
  } catch (error) {
    console.error("Error fetching media details:", error);
    res.status(500).json({ message: "Server error" });
  }
};
