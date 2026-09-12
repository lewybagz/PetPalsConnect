const Device = require("../models/Device");
const DevicePosition = require("../models/DevicePosition");
const Pet = require("../models/Pet");
const User = require("../models/User");
const vendors = require("../services/tracking/vendor");
const positions = require("../services/tracking/positions");
const visibility = require("../services/tracking/visibility");

/**
 * The tracking collar.
 *
 * Claiming a device, reading where a pet's collar is, and sharing that with
 * a friend for a while. Every position read passes through
 * `visibility.canView` first and a refusal is a 404 - the same answer as a
 * pet that does not exist, so nothing here says whether there is a collar to
 * see.
 *
 * Positions here are exact. That is the point of the feature and the reverse
 * of the discovery map's rule, which is why the two never share a code path:
 * `/api/petmatches/map` still rounds, and `map.test.js` still checks it.
 */

const SERIAL = /^[A-Z0-9][A-Z0-9-]{4,30}[A-Z0-9]$/;

const disabled = (res) =>
  res.status(503).json({ message: "Tracking isn't available on this server.", code: "TRACKING_DISABLED" });

/** A device as the owner sees it. The secret hash never leaves. */
const publicDevice = (device, latest) => ({
  _id: device._id,
  pet: device.pet,
  serial: device.serial,
  vendor: device.vendor,
  status: device.status,
  batteryPercent: device.batteryPercent ?? null,
  lastSeenAt: device.lastSeenAt ?? null,
  createdDate: device.createdDate,
  latest: latest ?? null,
});

const TrackingController = {
  /** Whether this server tracks anything, and how a device reports in. */
  async getStatus(req, res) {
    const vendor = vendors.current();
    res.json({
      enabled: Boolean(vendor),
      vendor: vendor?.name ?? null,
      acceptsIngest: Boolean(vendor?.acceptsIngest),
    });
  },

  /**
   * Claims a collar for one of the caller's pets.
   *
   * The owner is the caller. The secret, for a vendor whose devices POST to
   * us, is returned exactly once here and stored only as a hash.
   */
  async claimDevice(req, res) {
    const vendor = vendors.current();
    if (!vendor) return disabled(res);

    try {
      const { serial, petId } = req.body ?? {};
      const normalised = typeof serial === "string" ? serial.trim().toUpperCase() : "";
      if (!SERIAL.test(normalised)) {
        return res.status(400).json({ message: "That doesn't look like a collar serial." });
      }

      const pet = await Pet.findOne({ _id: petId, owner: req.userId }).select("_id").lean();
      if (!pet) return res.status(404).json({ message: "Pet not found" });

      const taken = await Device.findOne({ serial: normalised }).select("owner").lean();
      if (taken && String(taken.owner) !== String(req.userId)) {
        return res.status(409).json({ message: "That serial is already registered.", code: "SERIAL_TAKEN" });
      }

      const secret = vendor.acceptsIngest ? vendor.newSecret() : null;
      const update = {
        owner: req.userId,
        pet: pet._id,
        vendor: vendor.name,
        status: "active",
        modifiedDate: new Date(),
        ...(secret ? { ingestSecretHash: vendor.hashSecret(secret) } : {}),
      };
      const device = await Device.findOneAndUpdate(
        { serial: normalised },
        { $set: update, $setOnInsert: { serial: normalised, createdDate: new Date() } },
        { upsert: true, returnDocument: "after" }
      );

      res.status(201).json({ device: publicDevice(device, null), secret });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /** The caller's collars, each with where it last was. */
  async listDevices(req, res) {
    if (!vendors.enabled()) return disabled(res);
    try {
      const devices = await Device.find({ owner: req.userId }).lean();
      await positions.tick(devices);
      const latest = await positions.latestFor(devices);
      res.json(devices.map((device) => publicDevice(device, latest.get(String(device._id)))));
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /** Moves a collar to another of the caller's pets, or retires it. */
  async updateDevice(req, res) {
    if (!vendors.enabled()) return disabled(res);
    try {
      const device = await Device.findOne({ _id: req.params.deviceId, owner: req.userId });
      if (!device) return res.status(404).json({ message: "Not found" });

      const { petId, status } = req.body ?? {};
      if (petId) {
        const pet = await Pet.findOne({ _id: petId, owner: req.userId }).select("_id").lean();
        if (!pet) return res.status(404).json({ message: "Pet not found" });
        device.pet = pet._id;
      }
      if (status && Device.STATUSES.includes(status)) device.status = status;
      device.modifiedDate = new Date();
      await device.save();

      res.json(publicDevice(device, null));
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /** Removes a collar and every position it ever reported. */
  async removeDevice(req, res) {
    if (!vendors.enabled()) return disabled(res);
    try {
      const device = await Device.findOneAndDelete({ _id: req.params.deviceId, owner: req.userId });
      if (!device) return res.status(404).json({ message: "Not found" });
      await DevicePosition.deleteMany({ device: device._id });
      res.json({ removed: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * Where a pet's collar is now and has recently been.
   *
   * Exact coordinates, for the owner or a friend with a live share. Anybody
   * else, or a pet with no collar, is a 404.
   */
  async getPetPositions(req, res) {
    if (!vendors.enabled()) return disabled(res);
    try {
      const petId = req.params.petId;
      if (!(await visibility.canView(req.userId, petId))) {
        return res.status(404).json({ message: "Not found" });
      }

      const [pet, devices] = await Promise.all([
        Pet.findById(petId).select("name photos owner").lean(),
        Device.find({ pet: petId, status: "active" }).lean(),
      ]);
      if (!pet || devices.length === 0) return res.status(404).json({ message: "Not found" });

      await positions.tick(devices);
      const device = devices[0];
      const [latest, trail, owner] = await Promise.all([
        positions.latestFor([device]),
        positions.trailFor(device._id),
        User.findById(pet.owner).select("username").lean(),
      ]);

      res.json({
        pet: { _id: pet._id, name: pet.name, photos: pet.photos ?? [] },
        owner: { _id: pet.owner, username: owner?.username ?? null },
        device: publicDevice(device, latest.get(String(device._id))),
        latest: latest.get(String(device._id)) ?? null,
        trail,
        serverTime: new Date(),
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /** The shares the caller has given and received. */
  async listShares(req, res) {
    if (!vendors.enabled()) return disabled(res);
    try {
      res.json(await visibility.sharesFor(req.userId));
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /** Shares one of the caller's pets with a friend for `hours`. */
  async sharePet(req, res) {
    if (!vendors.enabled()) return disabled(res);
    try {
      const { viewer, hours } = req.body ?? {};
      const row = await visibility.share({
        ownerId: req.userId,
        petId: req.params.petId,
        viewerId: viewer,
        hours,
      });
      res.status(201).json(row);
    } catch (error) {
      if (error instanceof visibility.ShareError) {
        return res.status(error.status).json({ message: error.message });
      }
      res.status(500).json({ message: error.message });
    }
  },

  /** Ends a share the caller gave. */
  async unsharePet(req, res) {
    if (!vendors.enabled()) return disabled(res);
    try {
      const removed = await visibility.unshare({
        ownerId: req.userId,
        petId: req.params.petId,
        viewerId: req.params.userId,
      });
      res.json({ removed });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * A device reporting in. Outside `authenticate` - a collar has no Firebase
   * account - and authenticated by the per-device secret instead.
   */
  async ingest(req, res) {
    const vendor = vendors.current();
    if (!vendor || !vendor.acceptsIngest) return disabled(res);

    try {
      const serial = String(req.headers["x-device-serial"] ?? "").trim().toUpperCase();
      const secret = req.headers["x-device-secret"];
      const device = serial ? await Device.findOne({ serial }).lean() : null;

      // One answer for "no such serial" and "wrong secret".
      if (!device || !vendor.secretMatches(secret, device.ingestSecretHash)) {
        return res.status(401).json({ message: "Unauthorised" });
      }
      if (device.status !== "active") {
        return res.status(202).json({ received: false, reason: "inactive" });
      }

      const sample = vendor.parse(req.body);
      if (!sample) return res.status(400).json({ message: "That isn't a position." });

      await positions.record(device, sample);
      res.status(202).json({ received: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};

module.exports = TrackingController;
