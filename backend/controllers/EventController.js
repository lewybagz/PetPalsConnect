const Event = require("../models/Event");

const EventController = {
  async getAllEvents(req, res) {
    try {
      const events = await Event.find()
        .populate("Attendees")
        .populate("Organizer")
        .populate("Creator");
      res.json(events);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getEventById(req, res, next) {
    let event;
    try {
      event = await Event.findById(req.params.id)
        .populate("Attendees")
        .populate("Organizer")
        .populate("Creator");
      if (event == null) {
        return res.status(404).json({ message: "Cannot find event" });
      }
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.event = event;
    next();
  },

  async createEvent(req, res) {
    const event = new Event({
      Attendees: req.body.Attendees,
      Date: req.body.Date,
      Description: req.body.Description,
      Organizer: req.body.Organizer,
      Title: req.body.Title,
      Creator: req.body.Creator,
      Slug: req.body.Slug,
    });

    try {
      const newEvent = await event.save();
      res.status(201).json(newEvent);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

module.exports = EventController;
