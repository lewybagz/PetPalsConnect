const mongoose = require("mongoose");

const User = require("../../models/User");
const Pet = require("../../models/Pet");
const WeightEntry = require("../../models/WeightEntry");
const vaccinations = require("../vaccinations");
const settings = require("../settings");

/**
 * What the model is told about the owner before it reads the question.
 *
 * The prompt used to say "call `my_pets` first for any question about a pet",
 * which is a tool round-trip - an extra model iteration, a second or two, and
 * several hundred tokens - to fetch a roster the server already has in hand.
 * So the roster travels with the message: a short text block appended to the
 * user turn, built fresh from the database each time. It goes on the message
 * and never on the system prompt, because the `tools -> system` prefix is
 * frozen and cached, and a date in it would invalidate that on every call.
 *
 * Also here: the owner's local date and time (a reminder "due Tuesday" needs
 * to know which Tuesday), the units they prefer, and Spot's notes - the
 * things they asked it to remember, capped and visible on the Spot screen.
 */

const MAX_OFFSET_MINUTES = 14 * 60;
const NOTE_LIMIT = 20;
const NOTE_LENGTH = 140;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The owner's wall clock, from the offset the app sends with every message. */
const localClock = (now = new Date(), utcOffsetMinutes = 0) => {
  const offset = Number.isFinite(Number(utcOffsetMinutes))
    ? Math.max(-MAX_OFFSET_MINUTES, Math.min(MAX_OFFSET_MINUTES, Number(utcOffsetMinutes)))
    : 0;
  const local = new Date(now.getTime() + offset * 60 * 1000);
  return {
    date: local.toISOString().slice(0, 10),
    time: local.toISOString().slice(11, 16),
    weekday: WEEKDAYS[local.getUTCDay()],
  };
};

const UNIT_WORDS = { mi: "miles", km: "kilometres", lb: "pounds", kg: "kilograms" };

const describePet = (pet, weightUnit) => {
  const parts = [pet.species ?? "dog"];
  if (pet.breed) parts.push(pet.breed);
  if (pet.age != null) parts.push(`${pet.age} ${pet.age === 1 ? "year" : "years"}`);
  if (pet.weight != null) {
    parts.push(
      (weightUnit === "kg" ? `${pet.weight} lb (${(pet.weight * 0.45359237).toFixed(1)} kg)` : `${pet.weight} lb`) +
        (pet.weighedOn ? ` weighed ${pet.weighedOn}` : "")
    );
  }
  parts.push(`vaccinations ${pet.vaccinationStatus ?? "unknown"}`);
  return `- ${pet.name} (petId ${pet.petId}): ${parts.join(", ")}`;
};

/**
 * The block, as text. Pure, so the exact wording is tested.
 *
 * `pets` are `{ petId, name, species, breed, age, weight, weighedOn,
 * vaccinationStatus }`; `notes` are strings. The weigh-in date is here because
 * the first live eval showed the model calling `my_pets` just to get it. Weights are always pounds - storage is canonical - and
 * the kilogram figure is added when that is what the owner reads.
 */
const contextBlock = ({ now = new Date(), utcOffsetMinutes = 0, units = {}, pets = [], notes = [] } = {}) => {
  const clock = localClock(now, utcOffsetMinutes);
  const distance = UNIT_WORDS[units.distance] ?? "miles";
  const weight = UNIT_WORDS[units.weight] ?? "pounds";
  const lines = [
    `Today is ${clock.weekday} ${clock.date}, ${clock.time} where the owner is. The owner reads ${distance} and ${weight}; weights below are stored in pounds.`,
  ];
  if (pets.length === 0) {
    lines.push("Pets: none on the profile yet.");
  } else {
    lines.push("Pets on the profile (current; call my_pets only for temperament, activity or socialisation):");
    lines.push(...pets.map((pet) => describePet(pet, units.weight)));
  }
  if (notes.length > 0) {
    lines.push("Things the owner asked you to remember:");
    lines.push(...notes.slice(0, NOTE_LIMIT).map((note) => `- ${note}`));
  }
  return lines.join("\n");
};

/** Everything the block needs, read fresh for this owner. */
const gather = async (userId, { now = new Date(), utcOffsetMinutes = 0 } = {}) => {
  const owner = await User.findById(userId).select("pets units spotNotes").lean();
  const pets = await Pet.find({ _id: { $in: owner?.pets ?? [] } })
    .select("name species breed age weight")
    .lean();
  const statuses = await vaccinations.statusForPets(pets.map((pet) => pet._id));
  const latest = pets.length
    ? await WeightEntry.aggregate([
        { $match: { owner: new mongoose.Types.ObjectId(String(userId)) } },
        { $sort: { takenAt: -1 } },
        { $group: { _id: "$pet", takenAt: { $first: "$takenAt" } } },
      ])
    : [];
  const weighedOn = new Map(latest.map((row) => [String(row._id), row.takenAt.toISOString().slice(0, 10)]));
  const notes = (owner?.spotNotes ?? []).map((note) => note.text);
  return contextBlock({
    now,
    utcOffsetMinutes,
    units: settings.withDefaults(owner ?? {}).units,
    pets: pets.map((pet) => ({
      petId: String(pet._id),
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      age: pet.age,
      weight: pet.weight,
      weighedOn: weighedOn.get(String(pet._id)) ?? null,
      vaccinationStatus: statuses.get(String(pet._id)) ?? "unknown",
    })),
    notes,
  });
};

module.exports = { contextBlock, gather, localClock, NOTE_LIMIT, NOTE_LENGTH };
