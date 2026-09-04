const FriendRequest = require("../models/FriendRequest");
const User = require("../models/User");
const FriendController = require("./FriendController");
const { notify } = require("../services/NotificationService");
const { emitToUser } = require("../services/realtime");

/**
 * The two parties as plain ids.
 *
 * The loader populates both, so `friendRequest.sender` is a User *document*
 * downstream and a raw ObjectId elsewhere. Anything that compares or stores
 * them has to go through this, or it compares a document to an id.
 */
const idOf = (party) => String(party?._id ?? party);
const senderId = (friendRequest) => idOf(friendRequest.sender);
const receiverId = (friendRequest) => idOf(friendRequest.receiver);

/**
 * Records that these two are now friends.
 *
 * This looked for `{ sender, receiver }` - neither of which is a path on the
 * Friend schema, which has `user1`/`user2` - so it found nothing, logged
 * "Friend relationship not found." and returned. Nothing else ever wrote a
 * Friend row either, so accepting a friend request has never made two people
 * friends: the request went to "accepted" and the friends list stayed empty.
 */
async function updateFriendStatus(sender, receiver) {
  try {
    await FriendController.linkFriends(sender, receiver);
  } catch (err) {
    console.error("Failed to update friend status:", err);
  }
}

const FriendRequestController = {
  async getAllFriendRequests(req, res) {
    try {
      // Was `find()` with no filter: behind `authenticate`, but that only means
      // you need *an* account, not that the rows are yours.
      const friendRequests = await FriendRequest.find({
        $or: [{ sender: req.userId }, { receiver: req.userId }],
      })
        .populate("sender")
        .populate("receiver");
      res.json(friendRequests);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getFriendRequestById(req, res, next) {
    try {
      const friendRequest = await FriendRequest.findById(req.params.id)
        .populate("sender")
        .populate("receiver");
      if (!friendRequest) {
        return res.status(404).json({ message: "Friend request not found" });
      }
      // Fetching by id is not authorisation. Without this, any signed-in user
      // could read any friend request by guessing or harvesting an id.
      if (![friendRequest.sender, friendRequest.receiver]
        .map((party) => String(party?._id ?? party))
        .includes(String(req.userId))) {
        return res.status(404).json({ message: "Cannot find friend request" });
      }

      res.friendRequest = friendRequest;
      next();
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async acceptFriendRequest(req, res) {
    if (!res.friendRequest) {
      return res.status(404).json({ message: "No friend request loaded" });
    }
    // The loader lets either party through, which is right for reading it and
    // wrong for this: without the check, the sender could accept their own
    // request and make somebody their friend unilaterally.
    if (String(receiverId(res.friendRequest)) !== String(req.userId)) {
      return res
        .status(403)
        .json({ message: "Only the person invited can accept" });
    }
    if (res.friendRequest.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Friend request is not in a pending state" });
    }

    try {
      const requester = await User.findById(senderId(res.friendRequest)).populate(
        "pets"
      );
      if (!requester) {
        console.log("Requester not found");
        return res.status(404).json({ message: "Requester not found" });
      }

      const petName = requester.pets[0]?.name || "Unknown Pet";

      res.friendRequest.status = "accepted";
      res.friendRequest.modifiedDate = Date.now();
      await res.friendRequest.save();

      // `createNotification` takes one options object, not (id, data): the
      // positional call destructured `content`/`recipientId` off an ObjectId,
      // so every field came out undefined. `data.type` said "acceptance",
      // which is not a type the app routes on, so the push went nowhere.
      await Promise.all([
        notify({
          content: `${petName} accepted your friend request!`,
          recipientId: requester._id,
          type: "friendAccepted",
          creatorId: req.userId,
          petName,
        }),
        updateFriendStatus(
          senderId(res.friendRequest),
          receiverId(res.friendRequest)
        ),
      ]);

      res.status(200).json({ message: "Friend request accepted" });
    } catch (err) {
      console.error("Error accepting friend request:", err);
      res.status(500).json({ message: err.message });
    }
  },

  // Method to decline a friend request
  async declineFriendRequest(req, res) {
    try {
      if (!res.friendRequest) {
        return res.status(404).json({ message: "No friend request loaded" });
      }
      // As with accepting: the loader admits either party, but only the person
      // invited gets to answer.
      if (String(receiverId(res.friendRequest)) !== String(req.userId)) {
        return res
          .status(403)
          .json({ message: "Only the person invited can decline" });
      }
      if (res.friendRequest.status !== "pending") {
        return res
          .status(400)
          .json({ message: "Friend request is not in a pending state" });
      }

      res.friendRequest.status = "declined";
      res.friendRequest.modifiedDate = Date.now();
      await res.friendRequest.save();
      res.status(200).json({ message: "Friend request declined" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async createFriendRequest(req, res) {
    // `sender` came from the body, so a client could send a friend request as
    // somebody else - and the receiver would see their name on it. The audit
    // missed it because the field was destructured first and then written in
    // shorthand, which is why it now checks the destructure too.
    const sender = req.userId;
    const { receiver } = req.body;

    if (!receiver) {
      return res.status(400).json({ message: "receiver is required" });
    }
    if (String(receiver) === String(sender)) {
      return res.status(400).json({ message: "You cannot befriend yourself" });
    }

    const newFriendRequest = new FriendRequest({
      sender,
      receiver,
      status: "pending",
    });

    try {
      const savedFriendRequest = await newFriendRequest.save();
      const senderUser = await User.findById(sender).populate("pets");
      const receiverUser = await User.findById(receiver).populate("pets");

      const senderPetName = senderUser.pets[0]?.name || "Your pet";
      const receiverPetName = receiverUser.pets[0]?.name || "Your pet";

      // `sendPushNotification(notificationData)` put the payload where the
      // recipient goes, so Mongoose was handed an object to cast to an
      // ObjectId and threw - inside the `Promise.all` of the create path,
      // which turned every friend request into a 400.
      await notify({
        content: `${senderPetName} wants to be friends with ${receiverPetName}!`,
        recipientId: receiver,
        type: "friendRequest",
        creatorId: sender,
        petName: senderPetName,
        data: { requesterId: sender },
      });

      // Let the recipient's friends list update without a refetch.
      emitToUser(receiver, "friendRequest", savedFriendRequest);

      res.status(201).json(savedFriendRequest);
    } catch (err) {
      console.error("Failed to create friend request:", err);
      res.status(400).json({ message: err.message });
    }
  },

  async updateFriendRequest(req, res) {
    if (req.body.status) {
      res.friendRequest.status = req.body.status;
    }
    res.friendRequest.modifiedDate = Date.now();

    try {
      const updatedFriendRequest = await res.friendRequest.save();
      res.json(updatedFriendRequest);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

module.exports = FriendRequestController;
