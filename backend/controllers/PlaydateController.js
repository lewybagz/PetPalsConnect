const Playdate = require("../models/Playdate");
import {
  sendPlaydateNotification,
  pushPlaydateReviewReminderNotification,
} from "./NotificationController";
import { createNotification } from "../services/NotificationService";
const Pet = require("../models/Pet");
const User = require("../models/User");
const { sendPushNotification } = require("./NotificationController");

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
      const userId = req.userId;
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
        .populate("location") // Assuming 'location' is a simple reference in Playdate
        .populate("participants")
        .populate("petsInvolved")
        .populate("creator", "name locationSharingEnabled");

      if (!playdate) {
        return res.status(404).json({ message: "Playdate not found" });
      }

      if (playdate.creator.locationSharingEnabled === false) {
        playdate.location = null;
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
        date: { $gte: now },
        status: "accepted",
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
    const { playdateId } = req.params;
    const userId = req.userId;

    try {
      let playdate = await Playdate.findById(playdateId)
        .populate({
          path: "participants",
          populate: { path: "pets" },
        })
        .populate({
          path: "creator",
          populate: { path: "pets" },
        });

      if (!playdate) {
        return res.status(404).json({ message: "Playdate not found" });
      }

      if (
        !playdate.participants.some((participant) =>
          participant._id.equals(userId)
        )
      ) {
        playdate.participants.push(userId);
        playdate.status = "accepted";
      }

      const acceptersFirstPetName =
        (await User.findById(userId).populate("pets")).pets[0]?.name ||
        "Unknown Pet";
      const requestSenderFirstPetName =
        playdate.creator.pets[0]?.name || "Unknown Pet";

      const notificationData = {
        recipientId: playdate.creator._id,
        title: "Playdate Request Accepted",
        message: `Hey ${requestSenderFirstPetName}! Your playdate with ${acceptersFirstPetName} has been confirmed.`,
        data: {
          playdateId,
          acceptersFirstPetName,
          requestSenderFirstPetName,
        },
      };

      // Using Promise.all to handle concurrent tasks
      await Promise.all([
        playdate.save(),
        createNotification({
          content: notificationData.message,
          recipientId: playdate.creator._id,
          type: "Playdate Request Accepted",
          creatorId: userId,
        }),
        sendPlaydateNotification(notificationData),
      ]);

      return res.status(200).json({ message: "Playdate accepted" });
    } catch (error) {
      console.error("Error accepting playdate:", error);
      return res
        .status(500)
        .json({ message: "Error accepting playdate", error });
    }
  },

  async cancelPlaydate(req, res) {
    const { playdateId } = req.params;
    const { message } = req.body;
    const userId = req.userId;

    try {
      const playdate = await Playdate.findByIdAndUpdate(
        playdateId,
        {
          status: "cancelled",
          cancellationReason: message || "No specific reason provided",
        },
        { new: true }
      )
        .populate({
          path: "participants",
          populate: { path: "pets" },
        })
        .populate({
          path: "creator",
          populate: { path: "pets" },
        });

      if (!playdate) {
        return res.status(404).json({ message: "Playdate not found" });
      }

      // Prepare notifications for participants
      const notifications = playdate.participants
        .filter((participant) => participant._id.toString() !== userId)
        .map((participant) => {
          const participantPetName = participant.pets[0]?.name || "Unknown Pet";
          const cancellingUserPetName =
            playdate.creator.pets[0]?.name || "Unknown Pet";

          const notificationData = {
            recipientUserId: participant._id,
            title: "Playdate Cancelled",
            message: `${participantPetName}, a playdate with ${cancellingUserPetName} has been cancelled. Reason: ${
              message || "No specific reason"
            }`,
            data: {
              playdateId,
              cancelledBy: userId,
              reason: message || "No specific reason provided",
            },
          };
          return Promise.all([
            sendPushNotification(notificationData),
            createNotification({
              content: notificationData.message,
              recipientId: participant._id,
              type: "Playdate Cancelled",
              creatorId: userId,
            }),
          ]);
        });

      // Notify the creator if not the one cancelling
      if (playdate.creator._id.toString() !== userId) {
        const cancellingUserPetName =
          playdate.creator.pets[0]?.name || "Unknown Pet";
        const notificationData = {
          recipientUserId: playdate.creator._id,
          title: "Playdate Cancelled",
          message: `Your playdate involving ${cancellingUserPetName} has been cancelled. Reason: ${
            message || "No specific reason"
          }`,
          data: {
            playdateId,
            cancelledBy: userId,
            reason: message || "No specific reason provided",
          },
        };
        notifications.push(
          Promise.all([
            sendPlaydateNotification(notificationData),
            createNotification({
              content: notificationData.message,
              recipientId: playdate.creator._id,
              type: "Playdate Cancelled",
              creatorId: userId,
            }),
          ])
        );
      }

      await Promise.all(notifications);

      return res.json({ message: "Playdate cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling playdate:", error);
      return res
        .status(500)
        .json({ message: "Error cancelling playdate", error });
    }
  },

  async declinePlaydate(req, res) {
    const { playdateId } = req.params;
    try {
      let playdate = await Playdate.findById(playdateId);
      if (!playdate) {
        return res.status(404).json({ message: "Playdate not found" });
      }

      // Update playdate status to 'declined'
      playdate.status = "declined";
      await playdate.save();

      return res.status(200).json({ message: "Playdate declined" });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Error declining playdate", error });
    }
  },
  async createPlaydate(req, res) {
    const { date, location, notes, participants, petsInvolved, creator } =
      req.body;

    try {
      const playdate = new Playdate({
        date,
        location,
        notes,
        participants,
        petsInvolved,
        creator,
      });

      const newPlaydate = await playdate.save();

      // Fetch the creator's first pet
      const creatorUser = await User.findById(creator).populate("pets");
      const creatorFirstPetName = creatorUser.pets[0]?.name || "Creator's Pet";

      const petOwnersPromises = petsInvolved.map((petId) =>
        Pet.findById(petId).populate("owner").exec()
      );
      const pets = await Promise.all(petOwnersPromises);

      pets.forEach(async (pet) => {
        if (pet.owner._id.toString() !== creator) {
          const notificationData = {
            recipientUserId: pet.owner._id,
            title: "Playdate Request",
            message: `${creatorFirstPetName} wants to schedule a playdate with ${pet.name}.`,
            data: { playdateId: newPlaydate._id },
          };
          await Promise.all([
            sendPlaydateNotification(notificationData),
            createNotification(notificationData),
          ]);
        }
      });

      await pushPlaydateReviewReminderNotification(
        newPlaydate._id,
        req.body.creator
      );

      res.status(201).json(newPlaydate);
    } catch (err) {
      console.error("Error creating playdate:", err);
      res.status(400).json({ message: err.message });
    }
  },

  async updatePlaydateDetails(req, res) {
    const { playdateId } = req.params;
    const { date, time, location } = req.body;
    const userId = req.userId;

    try {
      let playdate = await Playdate.findById(playdateId)
        .populate({
          path: "petsInvolved",
          populate: { path: "owner" },
        })
        .populate("participants");

      if (!playdate) {
        return res.status(404).json({ message: "Playdate not found" });
      }

      if (playdate.creator.toString() !== userId) {
        return res
          .status(403)
          .json({ message: "Unauthorized to update this playdate" });
      }

      // Update playdate details
      playdate.date = date;
      playdate.time = time;
      playdate.location = location;
      await playdate.save();

      // Generate messages and notifications
      const notificationPromises = playdate.participants
        .filter((participant) => participant._id.toString() !== userId)
        .map((participant) => {
          const petNames = playdate.petsInvolved
            .filter((pet) => pet.owner._id.toString() !== userId)
            .map((pet) => pet.name)
            .join(", ");

          const message = `The details for the playdate on ${new Date(
            date
          ).toLocaleDateString()} with ${petNames} have been updated. Check out the new details!`;
          const notificationData = {
            recipientUserId: participant._id,
            title: "Playdate Updated",
            message: message,
            data: {
              playdateId,
              updatedDate: date,
              updatedTime: time,
              updatedLocation: location,
              petsInvolved: petNames,
            },
          };

          // Send notifications and create database entries simultaneously
          return Promise.all([
            sendPlaydateNotification(notificationData),
            createNotification({
              content: message,
              recipientId: participant._id,
              type: "Playdate Updated",
              creatorId: userId,
            }),
          ]);
        });

      await Promise.all(notificationPromises);

      return res
        .status(200)
        .json({ message: "Playdate updated successfully", playdate });
    } catch (error) {
      console.error("Error updating playdate details:", error);
      return res
        .status(500)
        .json({ message: "Error updating playdate details", error });
    }
  },
};

module.exports = PlaydateController;
