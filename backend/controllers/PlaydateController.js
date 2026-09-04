const Playdate = require("../models/Playdate");
const Location = require("../models/Location");
const {
  pushPlaydateReviewReminderNotification,
} = require("./NotificationController");
const { notify } = require("../services/NotificationService");
const Pet = require("../models/Pet");
const User = require("../models/User");

const PlaydateController = {
  async getAllPlaydates(req, res) {
    try {
      // Was every playdate in the database with everyone's participants.
      const playdates = await Playdate.find({ participants: req.userId })
        .populate("participants", "username userPhoto")
        .populate("petsInvolved", "name photos")
        .sort({ date: -1 });
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
      // Was every accepted playdate in the database, everyone's participants
      // populated - the "upcoming" tab showed strangers' plans.
      const playdates = await Playdate.find({
        date: { $gte: now },
        status: "accepted",
        participants: req.userId,
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

      // Anyone with a playdate id could accept somebody else's invitation, and
      // doing so added them to it.
      const isInvited = playdate.participants.some((participant) =>
        participant._id.equals(userId)
      );
      if (!isInvited) {
        return res.status(403).json({ message: "You were not invited to this" });
      }
      if (String(playdate.creator._id) === String(userId)) {
        return res.status(400).json({ message: "You organised this one" });
      }
      if (playdate.status !== "pending") {
        return res
          .status(409)
          .json({ message: `This playdate is already ${playdate.status}` });
      }

      playdate.status = "accepted";
      playdate.modifiedDate = new Date();

      const acceptersFirstPetName =
        (await User.findById(userId).populate("pets")).pets[0]?.name ||
        "Unknown Pet";
      const requestSenderFirstPetName =
        playdate.creator.pets[0]?.name || "Unknown Pet";

      const content = `Hey ${requestSenderFirstPetName}! Your playdate with ${acceptersFirstPetName} has been confirmed.`;

      // `sendPlaydateNotification` is Express middleware (req, res, next). Called
      // with a plain object it threw "next is not a function" on every accept,
      // which the catch below turned into a 500 - so accepting a playdate
      // always failed even once the record was right.
      await playdate.save();

      // `notify` stores the row, emits the socket event and sends the push, so
      // the three cannot come apart and the wording is written once.
      await notify({
        content,
        recipientId: playdate.creator._id,
        type: "playdateAccepted",
        creatorId: userId,
        petName: acceptersFirstPetName,
        data: { playdateId },
      });

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

          // `sendPushNotification(notificationData)` passed the payload where
          // the recipient goes, so Mongoose was asked to cast an object to an
          // ObjectId and threw - inside the `Promise.all` of the cancel path,
          // which made every cancellation a 500.
          return notify({
            content: `${participantPetName}, a playdate with ${cancellingUserPetName} has been cancelled. Reason: ${
              message || "no reason given"
            }`,
            recipientId: participant._id,
            type: "playdateCancelled",
            creatorId: userId,
            petName: cancellingUserPetName,
            data: { playdateId },
          });
        });

      // Notify the creator if not the one cancelling
      if (playdate.creator._id.toString() !== userId) {
        const cancellingUserPetName =
          playdate.creator.pets[0]?.name || "Unknown Pet";
        notifications.push(
          notify({
            content: `Your playdate involving ${cancellingUserPetName} has been cancelled. Reason: ${
              message || "no reason given"
            }`,
            recipientId: playdate.creator._id,
            type: "playdateCancelled",
            creatorId: userId,
            petName: cancellingUserPetName,
            data: { playdateId },
          })
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

      if (!playdate.participants.some((participant) => String(participant) === String(req.userId))) {
        return res.status(403).json({ message: "You were not invited to this" });
      }
      if (playdate.status !== "pending") {
        return res
          .status(409)
          .json({ message: `This playdate is already ${playdate.status}` });
      }

      playdate.status = "declined";
      playdate.modifiedDate = new Date();
      await playdate.save();

      // Declining silently left the organiser waiting on an answer that had
      // already been given.
      await notify({
        content: "Your playdate request was declined.",
        recipientId: playdate.creator,
        type: "playdateDeclined",
        creatorId: req.userId,
        data: { playdateId: playdate._id },
      });

      return res.status(200).json({ message: "Playdate declined" });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Error declining playdate", error });
    }
  },
  /**
   * Schedules a playdate.
   *
   * This has never once succeeded. `startTime` is required by the schema and
   * was never set, so every create failed validation with a 400 - and the app
   * sent `Date`/`Location`/`Creator` in PascalCase, which strict mode drops,
   * so `date`, `location` and `creator` were missing too.
   *
   * `creator` also came from the request body, and `participants` was whatever
   * the client passed - in practice just the sender, which is the same
   * one-participant bug direct messages had: the person being invited was
   * never in the record, so it never appeared in their list and they could not
   * accept it. Participants are now derived from the owners of the pets
   * involved.
   */
  async createPlaydate(req, res) {
    const { date, startTime, location, notes, petsInvolved } = req.body;

    if (!date || !location) {
      return res.status(400).json({ message: "date and location are required" });
    }
    if (!Array.isArray(petsInvolved) || petsInvolved.length === 0) {
      return res.status(400).json({ message: "petsInvolved is required" });
    }

    try {
      const place = await Location.findById(location).select("_id");
      if (!place) {
        return res.status(404).json({ message: "Cannot find that location" });
      }

      const pets = await Pet.find({ _id: { $in: petsInvolved } })
        .select("name owner")
        .lean();

      if (pets.length !== petsInvolved.length) {
        return res.status(404).json({ message: "Cannot find every pet" });
      }
      if (!pets.some((pet) => String(pet.owner) === String(req.userId))) {
        return res
          .status(403)
          .json({ message: "One of the pets has to be yours" });
      }

      // Everyone whose pet is coming, the organiser included. Without the other
      // owners here the invitation is invisible to them.
      const participants = [
        ...new Set([String(req.userId), ...pets.map((pet) => String(pet.owner))]),
      ];

      const when = new Date(date);
      const playdate = await Playdate.create({
        date: when,
        // Separate on the form (a date picker and a time picker) but the same
        // moment unless the client says otherwise.
        startTime: startTime ? new Date(startTime) : when,
        location: place._id,
        notes,
        participants,
        petsInvolved,
        status: "pending",
        creator: req.userId,
      });

      const organiser = await User.findById(req.userId).populate("pets");
      const organiserPetName = organiser?.pets?.[0]?.name ?? "A pet";

      const invitees = participants.filter(
        (participant) => participant !== String(req.userId)
      );

      await Promise.all(
        invitees.map(async (userId) => {
          const theirPet = pets.find((pet) => String(pet.owner) === userId);
          const content = `${organiserPetName} wants a playdate with ${
            theirPet?.name ?? "your pet"
          }.`;

          await notify({
            content,
            recipientId: userId,
            type: "playdate",
            creatorId: req.userId,
            petName: organiserPetName,
            data: { playdateId: playdate._id },
          });
        })
      );

      // Best-effort: a reminder that cannot be scheduled must not fail the
      // playdate that was just created.
      try {
        await pushPlaydateReviewReminderNotification(playdate._id, req.userId);
      } catch (error) {
        console.warn("[playdates] Review reminder not scheduled:", error.message);
      }

      const populated = await Playdate.findById(playdate._id)
        .populate("location")
        .populate("petsInvolved", "name photos owner")
        .populate("participants", "username userPhoto");

      res.status(201).json(populated);
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

          const content = `The details for the playdate on ${new Date(
            date
          ).toLocaleDateString()} with ${petNames} have changed.`;

          // Same missing-recipient bug as the cancel path: this called Express
          // middleware with a plain object, so it threw on `req.body` being
          // undefined and turned every detail edit into a 500.
          return notify({
            content,
            recipientId: participant._id,
            type: "playdate",
            creatorId: userId,
            petName: petNames,
            data: { playdateId },
          });
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
