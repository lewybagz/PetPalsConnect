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
    // Seven PascalCase keys, five of them required. Nothing was ever stored.
    const event = new Event({
      attendees: req.body.attendees,
      date: req.body.date,
      description: req.body.description,
      organizer: req.body.organizer ?? req.userId,
      title: req.body.title,
      creator: req.userId,
      slug: req.body.slug,
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
