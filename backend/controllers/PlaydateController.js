const Playdate = require("../models/Playdate");

const PlaydateController = {
  async getAllPlaydates(req, res) {
    try {
      const playdates = await Playdate.find()
        .populate("Participants")
        .populate("PetsInvolved")
        .populate("Creator");
      res.json(playdates);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async acceptPlaydate(playdateId) {
    try {
      // Assuming axios is used for API calls
      const response = await axios.post(`/api/playdates/accept/${playdateId}`);

      if (response.status === 200) {
        sendNotificationToSender(
          playdateId,
          "Your playdate request has been accepted."
        );
      }
    } catch (error) {
      console.error("Error accepting playdate:", error);
      // Handle the error appropriately
    }
  },

  async declinePlaydate(playdateId) {
    try {
      // Assuming axios is used for API calls
      const response = await axios.post(`/api/playdates/decline/${playdateId}`);

      if (response.status === 200) {
        sendNotificationToSender(
          playdateId,
          "Your playdate request has been declined."
        );
      }
    } catch (error) {
      console.error("Error declining playdate:", error);
      // Handle the error appropriately
    }
  },

  async sendNotificationToSender(playdateId, message) {
    try {
      // Fetch playdate details to get the sender's user ID
      const playdateResponse = await axios.get(`/api/playdates/${playdateId}`);
      const senderId = playdateResponse.data.senderId; // Assuming sender's ID is part of playdate details

      // Fetch sender's FCM token from the database
      const userResponse = await axios.get(`/api/users/${senderId}`);
      const fcmToken = userResponse.data.fcmToken;

      if (fcmToken) {
        // Send notification logic, using Firebase Cloud Messaging (FCM) or similar service
        await axios.post("/api/send-notification", {
          token: fcmToken,
          title: "Playdate Update",
          body: message,
          playdateId: playdateId,
          // Additional payload data can be added here if needed
        });
      } else {
        console.log("FCM token not found for the user");
      }
    } catch (error) {
      console.error("Error sending notification:", error);
      // Handle the error appropriately
    }
  },

  async getPlaydateById(req, res, next) {
    try {
      const playdate = await Playdate.findById(req.params.id)
        .populate({
          path: "Location",
          match: { "Creator.locationSharingEnabled": { $ne: false } },
        })
        .populate("Participants")
        .populate("PetsInvolved")
        .populate("Creator");

      if (!playdate) {
        return res.status(404).json({ message: "Playdate not found" });
      }

      // Modify the playdate data to remove location if the creator's locationSharingEnabled is false
      if (playdate.Creator.locationSharingEnabled === false) {
        playdate.Location = null; // or handle it as needed
      }

      res.json(playdate);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getUpcomingPlaydates(req, res) {
    try {
      const now = new Date();
      const playdates = await Playdate.find({
        Date: { $gte: now }, // Fetch playdates with a date greater than or equal to now
        Status: "accepted", // Assuming there's a Status field in your Playdate schema
      })
        .populate("Participants")
        .populate("PetsInvolved")
        .populate("Creator");
      res.json(playdates);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async acceptPlaydate(req, res) {
    const { playdateId, userId } = req.params; // Assuming userId is passed in the request
    try {
      let playdate = await Playdate.findById(playdateId);
      if (!playdate) {
        return res.status(404).json({ message: "Playdate not found" });
      }

      // Update playdate status to 'accepted' and add the user to participants
      playdate.Status = "accepted";
      if (!playdate.Participants.includes(userId)) {
        playdate.Participants.push(userId);
      }
      await playdate.save();

      // Logic to send a notification to the playdate creator...
      sendPushNotification({
        recipientUserId: playdate.Creator, // Use the ID of the playdate creator
        title: "Playdate Request Accepted",
        message: "Your playdate request has been accepted.",
        data: { playdateId }, // Additional data if needed
      });

      return res.status(200).json({ message: "Playdate accepted" });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Error accepting playdate", error });
    }
  },

  async declinePlaydate(req, res) {
    const { playdateId, userId } = req.params; // Assuming userId is passed in the request
    try {
      let playdate = await Playdate.findById(playdateId);
      if (!playdate) {
        return res.status(404).json({ message: "Playdate not found" });
      }

      // Update playdate status to 'declined'
      playdate.Status = "declined";
      await playdate.save();

      // Logic to send a notification to the playdate creator...
      sendPushNotification({
        recipientUserId: playdate.Creator, // Use the ID of the playdate creator
        title: "Playdate Request Declined",
        message: "Your playdate request has been declined.",
        data: { playdateId }, // Additional data if needed
      });
      return res.status(200).json({ message: "Playdate declined" });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Error declining playdate", error });
    }
  },

  async createPlaydate(req, res) {
    const playdate = new Playdate({
      Date: req.body.Date,
      Location: req.body.Location,
      Notes: req.body.Notes,
      Participants: req.body.Participants,
      PetsInvolved: req.body.PetsInvolved,
      Creator: req.body.Creator,
      Slug: req.body.Slug,
    });

    try {
      const newPlaydate = await playdate.save();
      res.status(201).json(newPlaydate);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

module.exports = PlaydateController;
