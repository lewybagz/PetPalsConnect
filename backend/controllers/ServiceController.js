const Service = require("../models/Service");

const ServiceController = {
  async getAllServices(req, res) {
    try {
      const services = await Service.find().populate("Creator");
      res.json(services);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getServiceById(req, res, next) {
    let service;
    try {
      service = await Service.findById(req.params.id).populate("Creator");
      if (service == null) {
        return res.status(404).json({ message: "Cannot find service" });
      }
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.service = service;
    next();
  },

  async createService(req, res) {
    const service = new service({
      contactInfo: req.body.contactInfo,
      location: req.body.location,
      name: req.body.name,
      serviceType: req.body.serviceType,
      creator: req.body.creator,
      slug: req.body.slug,
    });

    try {
      const newService = await service.save();
      res.status(201).json(newService);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

module.exports = ServiceController;
