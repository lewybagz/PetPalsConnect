const Playdate = require("../models/Playdate");
import {
  sendPlaydateNotification,
  pushPlaydateReviewReminderNotification,
} from "./NotificationController";

const PlaydateController = {
  async getAllPlaydates(req, res) {
    try {
      const playdates = await Playdate.find()
        .populate("participants")
        .populate("petsInvolved")
        .populate("creator", "name");
      res.json(playdates);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getUserPlaydates(req, res) {
    try {
      const userId = req.user._id; // Assuming req.user._id contains the current user's ID
      const playdates = await Playdate.find({
        $or: [{ participants: userId }, { creator: userId }],
      })
        .populate("participants")
        .populate("petsInvolved")
        .populate("creator", "name");
      res.json(playdates);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getPlaydateById(req, res) {
    try {
      const playdate = await Playdate.findById(req.params.id)
        .populate({
          path: "Location",
          match: { "creator.locationSharingEnabled": { $ne: false } },
        })
        .populate("participants")
        .populate("petsInvolved")
        .populate("creator", "name");

      if (!playdate) {
        return res.status(404).json({ message: "Playdate not found" });
      }

      // Modify the playdate data to remove location if the creator's locationSharingEnabled is false
      if (playdate.creator.locationSharingEnabled === false) {
        playdate.location = null; // or handle it as needed
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
        date: { $gte: now }, // Fetch playdates with a date greater than or equal to now
        status: "accepted", // Assuming there's a Status field in your Playdate schema
      })
        .populate("participants")
        .populate("petsInvolved")
        .populate("creator", "name");
      res.json(playdates);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // In PlaydateController
  async getLocationDetails(req, res) {
    try {
      const placeId = req.params.placeId;
      // Assuming you have a model or logic to fetch location details
      const locationDetails = await Location.findById(placeId);

      if (!locationDetails) {
        return res.status(404).json({ message: "Location not found" });
      }

      res.json(locationDetails);
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
      playdate.status = "accepted";
      if (!playdate.participants.includes(userId)) {
        playdate.participants.push(userId);
      }
      await playdate.save();

      // Prepare internal request object for notification
      const notificationReq = {
        body: {
          to: playdate.creator, // ID of the playdate creator
          title: "Playdate Request Accepted",
          body: "Your playdate request has been accepted.",
          data: { playdateId }, // Additional data if needed
        },
      };

      // Call sendPlaydateNotification
      await sendPlaydateNotification(notificationReq, res); // This might require adjustment based on how you handle responses

      return res.status(200).json({ message: "Playdate accepted" });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Error accepting playdate", error });
    }
  },

  async declinePlaydate(req, res) {
    const { playdateId } = req.params; // Assuming userId is passed in the request
    try {
      let playdate = await Playdate.findById(playdateId);
      if (!playdate) {
        return res.status(404).json({ message: "Playdate not found" });
      }

      // Update playdate status to 'declined'
      playdate.status = "declined";
      await playdate.save();

      // Prepare internal request object for notification
      const notificationReq = {
        body: {
          to: playdate.creator, // ID of the playdate creator
          title: "Playdate Request Declined",
          body: "Your playdate request has been declined.",
          data: { playdateId }, // Additional data if needed
        },
      };

      // Call sendPlaydateNotification
      await sendPlaydateNotification(notificationReq, res); // This might require adjustment based on how you handle responses

      return res.status(200).json({ message: "Playdate declined" });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Error declining playdate", error });
    }
  },
  async createPlaydate(req, res) {
    const playdate = new Playdate({
      date: req.body.date,
      location: req.body.location,
      notes: req.body.notes,
      participants: req.body.participants,
      petsInvolved: req.body.petsInvolved,
      creator: req.body.creator,
      slug: req.body.slug,
    });

    try {
      const newPlaydate = await playdate.save();

      // Schedule the review reminder notification
      await pushPlaydateReviewReminderNotification(
        newPlaydate._id,
        req.body.creator
      );

      res.status(201).json(newPlaydate);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

module.exports = PlaydateController;
