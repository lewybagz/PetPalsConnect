const mongoose = require("mongoose");
const { betaTool } = require("@anthropic-ai/sdk/helpers/beta/json-schema");

const User = require("../../models/User");
const Pet = require("../../models/Pet");
const HealthRecord = require("../../models/HealthRecord");
const WeightEntry = require("../../models/WeightEntry");
const Article = require("../../models/Article");
const Playdate = require("../../models/Playdate");
const Order = require("../../models/Order");
const Device = require("../../models/Device");
const Chat = require("../../models/Chat");
const Message = require("../../models/Message");

const weights = require("../weights");
const healthRecords = require("../healthRecords");
const vaccinations = require("../vaccinations");
const settings = require("../settings");
const blocking = require("../blocking");
const places = require("../places");
const toxins = require("../petCare/toxins");
const { EMERGENCY_CONTACTS } = require("../petCare/emergency");
const { CARE_CATEGORIES, OUT_CATEGORIES } = require("../placeCategories");
const { milesBetween, formatMiles } = require("../matching/distance");
const visibility = require("../tracking/visibility");
const positions = require("../tracking/positions");
const vendors = require("../tracking/vendor");
const { SCREENS, link } = require("./blocks");

/**
 * What Spot can do, as tools the model may call.
 *
 * Every tool is a thin wrapper over a query or a service that already exists;
 * nothing here is new logic. `toolsFor({ userId })` binds each one to the
 * signed-in owner, and a pet, record or entry id the model supplies is only
 * ever resolved through ownership - the same "a resource id is not an
 * identity" rule the controllers follow, one layer over. The static auth
 * audit scans controllers, not this file, so `spotTools.test.js` proves the
 * scoping with two accounts and an outsider.
 *
 * Writes call the one writer each thing already has (`services/weights`,
 * `services/healthRecords`, `services/settings`). They record a `done` effect
 * so the app can show what happened and offer the undo.
 *
 * Deliberately absent, and why - a list, not an omission:
 * - nothing on Order or Subscription: Stripe and RevenueCat are the writers
 * - no message, friend request or playdate invite to another person: it
 *   arrives on somebody else's phone, through audience and block rules
 * - no block, report, unblock: a safety action is a person's; `open_screen`
 *   can take them to Report
 * - no deleting a pet or the account: the existing confirmations stay the
 *   only route
 * - no notification: `notify()` is the only way, and Spot has no event
 * - no `spot.readChats` through `update_setting`: that one is a consent
 *   toggle and belongs to the Settings screen
 */

/** Tool results are JSON text; the model reads it, the app never sees it. */
const json = (value) => JSON.stringify(value);

/**
 * A tool that throws ends the turn with a 500 the person cannot read. A
 * service error (`status` + message) is something the model can explain -
 * "that isn't your pet" - so it comes back as a result rather than a throw.
 */
const guard = (run) => async (input, context) => {
  try {
    return await run(input, context);
  } catch (error) {
    if (error.status || error.name === "ValidationError") {
      return json({ error: error.message });
    }
    throw error;
  }
};

const object = (properties, required = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

const toISODate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : null);

/** The pets on the profile - the same authority the deck and the gate use. */
const ownPets = async (userId, select) => {
  const owner = await User.findById(userId).select("pets").lean();
  return Pet.find({ _id: { $in: owner?.pets ?? [] } }).select(select).lean();
};

/**
 * Builds the tool list for one request.
 *
 * `effects` is the list the tools append to as they run; the runner hands it
 * to `blocks.blocksFrom` afterwards. `readChats` decides whether `my_chats`
 * exists at all for this call - when the setting is off the model cannot
 * even ask, which is the enforcement `settingsEnforcement.test.js` checks.
 */
const toolsFor = ({ userId, readChats = false }) => {
  const effects = [];
  const done = (effect) => effects.push({ type: "done", ...effect });

  const tools = [
    betaTool({
      name: "my_pets",
      description:
        "The owner's own pets: name, species, breed, age in years, current weight in pounds, temperament, activity, vaccination status and the latest weigh-in. Call this first for any question about a pet.",
      inputSchema: object({}),
      run: guard(async () => {
        const pets = await ownPets(
          userId,
          "name species breed age weight temperament activityLevel socialisation favoriteActivities specialNeeds photos"
        );
        const statuses = await vaccinations.statusForPets(pets.map((pet) => pet._id));
        const latest = await WeightEntry.aggregate([
          { $match: { owner: new mongoose.Types.ObjectId(String(userId)) } },
          { $sort: { takenAt: -1 } },
          { $group: { _id: "$pet", pounds: { $first: "$pounds" }, takenAt: { $first: "$takenAt" } } },
        ]);
        const weighIns = new Map(latest.map((row) => [String(row._id), row]));

        return json({
          pets: pets.map((pet) => ({
            petId: String(pet._id),
            name: pet.name,
            species: pet.species ?? "dog",
            breed: pet.breed ?? null,
            ageYears: pet.age ?? null,
            weightPounds: pet.weight ?? null,
            temperament: pet.temperament ?? null,
            activityLevel: pet.activityLevel ?? null,
            socialisation: pet.socialisation ?? null,
            favoriteActivities: pet.favoriteActivities ?? [],
            // The owner's own words. Never a shopping input, never a diagnosis.
            ownerNotes: pet.specialNeeds || null,
            hasPhoto: (pet.photos ?? []).length > 0,
            vaccinationStatus: statuses.get(String(pet._id)) ?? "unknown",
            latestWeighIn: weighIns.has(String(pet._id))
              ? {
                  pounds: weighIns.get(String(pet._id)).pounds,
                  date: toISODate(weighIns.get(String(pet._id)).takenAt),
                }
              : null,
          })),
        });
      }),
    }),

    betaTool({
      name: "pet_health_records",
      description:
        "Every health record the owner has entered for one of their pets - vaccines, flea and tick, heartworm, medications, vet visits, microchip - newest first, with the derived vaccination status. Records are what the owner typed; nothing here is verified.",
      inputSchema: object({ petId: { type: "string" } }, ["petId"]),
      run: guard(async ({ petId }) => {
        const pet = await weights.ownPet(userId, petId, "owner name");
        const records = await HealthRecord.find({ pet: pet._id, owner: userId })
          .sort({ administeredAt: -1 })
          .lean();
        return json({
          petName: pet.name,
          status: vaccinations.statusOf(records),
          coreVaccines: vaccinations.CORE_KINDS,
          records: records.map((record) => ({
            recordId: String(record._id),
            kind: record.kind,
            category: vaccinations.categoryOf(record.kind),
            label: record.label ?? null,
            givenOn: toISODate(record.administeredAt),
            dueOn: toISODate(record.expiresAt),
            repeatsEveryDays: record.intervalDays ?? null,
            verification: record.verification,
            notes: record.notes ?? null,
          })),
        });
      }),
    }),

    betaTool({
      name: "toxin_lookup",
      description:
        "Whether something a pet ate or touched is in PetPals' poison table, with the published severity (emergency, call, avoid) and the helpline numbers. Say only what the table says. Never estimate an amount or a dose. A miss is an answer: still give the numbers.",
      inputSchema: object(
        {
          query: { type: "string", description: "What the pet got into, e.g. 'grapes', 'xylitol gum'" },
          species: {
            type: "string",
            enum: ["dog", "cat", "smallMammal", "bird", "reptile", "fish"],
          },
        },
        ["query"]
      ),
      run: guard(async ({ query, species }) => {
        effects.push({ type: "toxin", query });
        const matches = toxins
          .search(query)
          .filter((toxin) => !species || (toxin.species ?? []).includes(species));
        return json({
          matches: matches.map((toxin) => ({
            name: toxin.name,
            severity: toxin.severity,
            species: toxin.species,
            guidance: toxin.guidance ?? null,
            signs: toxin.signs ?? null,
            sources: (toxin.sources ?? []).map((source) =>
              typeof source === "string" ? source : [source.name, source.year].filter(Boolean).join(", ")
            ),
          })),
          severities: toxins.SEVERITIES,
          contacts: EMERGENCY_CONTACTS,
          note: matches.length
            ? "Never state or estimate how much is dangerous; the helpline weighs the amount."
            : "Not in the table. That is not reassurance - say so and give the numbers.",
        });
      }),
    }),

    betaTool({
      name: "emergency_contacts",
      description: "The animal poison helpline numbers. US and Canada; a consultation fee may apply.",
      inputSchema: object({}),
      run: guard(async () => {
        effects.push({ type: "toxin", query: null });
        return json({ contacts: EMERGENCY_CONTACTS });
      }),
    }),

    betaTool({
      name: "search_articles",
      description:
        "PetPals' own researched articles (sixty, cited, non-prescriptive). Returns titles and summaries; call read_article for the body. Prefer these over general knowledge for anything about health, behaviour or care.",
      inputSchema: object(
        {
          query: { type: "string" },
          tag: { type: "string", description: "Optional species or subject tag, e.g. 'cats', 'puppies'" },
        },
        ["query"]
      ),
      run: guard(async ({ query, tag }) => {
        const pattern = String(query).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (!pattern) return json({ articles: [] });
        const articles = await Article.find({
          ...(tag ? { tags: tag } : {}),
          $or: [
            { title: { $regex: pattern, $options: "i" } },
            { summary: { $regex: pattern, $options: "i" } },
            { tags: { $regex: pattern, $options: "i" } },
          ],
        })
          .select("title summary tags slug")
          .limit(6)
          .lean();
        return json({
          articles: articles.map((article) => ({
            articleId: String(article._id),
            title: article.title,
            summary: article.summary ?? null,
            tags: article.tags ?? [],
          })),
        });
      }),
    }),

    betaTool({
      name: "read_article",
      description: "The full text and sources of one PetPals article, by articleId from search_articles.",
      inputSchema: object({ articleId: { type: "string" } }, ["articleId"]),
      run: guard(async ({ articleId }) => {
        const article = await Article.findById(articleId)
          .select("title content sources tags lastReviewedDate")
          .lean();
        if (!article) return json({ error: "No such article" });
        effects.push({ type: "link", chip: link("ArticleDetail", article._id, article.title) });
        return json({
          title: article.title,
          lastReviewed: toISODate(article.lastReviewedDate),
          tags: article.tags ?? [],
          content: article.content,
          sources: (article.sources ?? []).map((source) => ({
            title: source.title,
            publisher: source.publisher,
            url: source.url,
          })),
        });
      }),
    }),

    betaTool({
      name: "care_places_nearby",
      description:
        "Vets, pet shops, groomers, boarders and dog-friendly patios, hotels and trails near the owner's last known position. Says plainly when no position is known or the area has not been imported yet.",
      inputSchema: object({
        category: {
          type: "string",
          enum: [...CARE_CATEGORIES, ...OUT_CATEGORIES],
          description: "Omit for all care categories",
        },
        rangeMiles: { type: "number", minimum: 1, maximum: 100 },
      }),
      run: guard(async ({ category, rangeMiles }) => {
        const owner = await User.findById(userId).select("geoLocation").lean();
        const coordinates = owner?.geoLocation?.coordinates;
        if (!coordinates || coordinates.length !== 2) {
          return json({
            locationKnown: false,
            places: [],
            note: "No position is known for this owner. Suggest turning on location sharing, or opening the care hub and choosing a city.",
          });
        }
        const [longitude, latitude] = coordinates;
        const found = await places.nearby({
          latitude,
          longitude,
          radiusMiles: rangeMiles ?? 15,
          categories: category ? [category] : CARE_CATEGORIES,
          limit: 8,
        });
        for (const place of found) {
          effects.push({ type: "link", chip: link("PotentialPlaydateLocation", place._id, place.name) });
        }
        return json({
          locationKnown: true,
          importable: places.isEnabled(),
          places: found.map((place) => ({
            locationId: String(place._id),
            name: place.name,
            categories: place.categories ?? [],
            address: place.address ?? null,
            distanceMiles: place.geoLocation?.coordinates
              ? formatMiles(milesBetween(coordinates, place.geoLocation.coordinates))
              : null,
            rating: place.rating ?? null,
          })),
          note: found.length ? null : "Nothing imported here yet. The care hub can import places for this area.",
        });
      }),
    }),

    betaTool({
      name: "my_playdates",
      description: "The owner's playdates, upcoming first: when, where, which pets, and status.",
      inputSchema: object({}),
      run: guard(async () => {
        const rows = await Playdate.find({ $or: [{ participants: userId }, { creator: userId }] })
          .populate("petsInvolved", "name owner")
          .populate("location", "name")
          .sort({ date: -1 })
          .limit(20)
          .lean();
        for (const row of rows.slice(0, 5)) {
          effects.push({ type: "link", chip: link("PlaydateDetails", row._id, "Open playdate") });
        }
        return json({
          playdates: rows.map((row) => ({
            playdateId: String(row._id),
            date: toISODate(row.date),
            startTime: row.startTime ?? null,
            place: row.location?.name ?? null,
            pets: (row.petsInvolved ?? []).map((pet) => ({
              name: pet.name,
              mine: String(pet.owner) === String(userId),
            })),
            status: row.status ?? null,
            organisedByMe: String(row.creator) === String(userId),
          })),
        });
      }),
    }),

    betaTool({
      name: "my_orders",
      description: "The owner's shop orders: status, items, total, and tracking where shipped. Read only - orders are changed in the shop, never here.",
      inputSchema: object({}),
      run: guard(async () => {
        const rows = await Order.find({ user: userId }).sort({ createdDate: -1 }).limit(10).lean();
        for (const row of rows.slice(0, 3)) {
          effects.push({ type: "link", chip: link("OrderDetail", row._id, "Open order") });
        }
        return json({
          orders: rows.map((row) => ({
            orderId: String(row._id),
            status: row.status,
            placedOn: toISODate(row.createdDate),
            items: (row.items ?? []).map((item) => ({
              name: item.name ?? item.description ?? null,
              quantity: item.quantity ?? 1,
            })),
            total: row.amountTotal != null ? row.amountTotal / 100 : null,
            currency: row.currency ?? "usd",
            carrier: row.carrier ?? null,
            trackingNumber: row.trackingNumber ?? null,
          })),
        });
      }),
    }),

    betaTool({
      name: "pet_last_seen",
      description:
        "Where a pet's tracking collar last reported, if the owner has one and it is visible to this person. Always say how old the position is. A collar shows where it last reported; it is not a safety device.",
      inputSchema: object({ petId: { type: "string" } }, ["petId"]),
      run: guard(async ({ petId }) => {
        if (!vendors.enabled()) return json({ available: false, reason: "Tracking is not enabled." });
        if (!(await visibility.canView(userId, petId))) return json({ available: false });
        const devices = await Device.find({ pet: petId, status: "active" }).lean();
        if (devices.length === 0) return json({ available: false });
        await positions.tick(devices);
        const latest = (await positions.latestFor(devices)).get(String(devices[0]._id)) ?? null;
        effects.push({ type: "link", chip: link("PetTracking", petId, "Tracking") });
        return json({
          available: true,
          latest,
          batteryPercent: devices[0].batteryPercent ?? null,
          lastSeenAt: devices[0].lastSeenAt ? new Date(devices[0].lastSeenAt).toISOString() : null,
        });
      }),
    }),

    betaTool({
      name: "my_settings",
      description: "The owner's account settings: units, playdate range, discovery filters and privacy.",
      inputSchema: object({}),
      run: guard(async () => {
        const user = await User.findById(userId)
          .select("playdateRange locationSharingEnabled notificationsEnabled units discovery privacy spot")
          .lean();
        const filled = settings.withDefaults(user ?? {});
        return json({
          playdateRange: user?.playdateRange ?? 25,
          locationSharingEnabled: user?.locationSharingEnabled ?? true,
          notificationsEnabled: user?.notificationsEnabled ?? true,
          units: filled.units,
          discovery: filled.discovery,
          privacy: filled.privacy,
          spot: filled.spot,
        });
      }),
    }),

    betaTool({
      name: "log_weight",
      description:
        "Records a weigh-in for one of the owner's pets, in pounds (convert first if they said kilograms), and updates the pet's current weight if this is the newest entry. Confirm the number in words if it was ambiguous.",
      inputSchema: object(
        {
          petId: { type: "string" },
          pounds: { type: "number", minimum: 0.1, maximum: 400 },
          takenAt: { type: "string", description: "ISO date; omit for now" },
          bodyCondition: { type: "integer", minimum: 1, maximum: 9 },
          notes: { type: "string", maxLength: 500 },
        },
        ["petId", "pounds"]
      ),
      run: guard(async ({ petId, pounds, takenAt, bodyCondition, notes }) => {
        const pet = await weights.ownPet(userId, petId, "owner name species");
        const entry = await weights.logWeight({
          ownerId: userId,
          petId,
          pounds,
          takenAt: takenAt ? new Date(takenAt) : undefined,
          bodyCondition,
          notes,
        });
        done({
          kind: "logWeight",
          summary: `Logged ${pet.name} at ${entry.pounds} lb`,
          undo: { kind: "removeWeight", petId: String(petId), entryId: String(entry._id) },
        });
        effects.push({ type: "link", chip: link("PetWeight", petId) });
        return json({ entryId: String(entry._id), pounds: entry.pounds, date: toISODate(entry.takenAt) });
      }),
    }),

    betaTool({
      name: "remove_weight",
      description: "Removes one weigh-in the owner entered. The pet's current weight follows the newest remaining entry.",
      inputSchema: object({ petId: { type: "string" }, entryId: { type: "string" } }, ["petId", "entryId"]),
      run: guard(async ({ petId, entryId }) => {
        const pet = await weights.ownPet(userId, petId, "owner name");
        const removed = await weights.removeWeight({ ownerId: userId, petId, entryId });
        done({ kind: "removeWeight", summary: `Removed ${pet.name}'s ${removed.pounds} lb entry` });
        return json({ removed: true });
      }),
    }),

    betaTool({
      name: "add_health_record",
      description:
        "Adds a health record the owner is telling you about: a vaccine with its certificate date, a flea/tick or heartworm dose, a medication (label required, never an amount), a vet visit, a microchip or licence number. Dates are what the owner said; never invent a due date.",
      inputSchema: object(
        {
          petId: { type: "string" },
          kind: { type: "string", enum: vaccinations.KINDS },
          administeredAt: { type: "string", description: "ISO date it was given" },
          expiresAt: { type: "string", description: "ISO date it is next due, only if the owner knows it" },
          intervalDays: { type: "integer", minimum: 1, maximum: 730 },
          label: { type: "string", maxLength: 60, description: "Medication name, chip or licence number" },
          notes: { type: "string", maxLength: 500 },
        },
        ["petId", "kind", "administeredAt"]
      ),
      run: guard(async ({ petId, kind, administeredAt, expiresAt, intervalDays, label, notes }) => {
        const pet = await weights.ownPet(userId, petId, "owner name");
        const record = await healthRecords.addRecord({
          ownerId: userId,
          petId,
          kind,
          administeredAt,
          expiresAt,
          intervalDays,
          label,
          notes,
        });
        done({
          kind: "addHealthRecord",
          summary: `Added ${label || kind} for ${pet.name}`,
          undo: { kind: "removeHealthRecord", petId: String(petId), recordId: String(record._id) },
        });
        effects.push({ type: "link", chip: link("PetHealth", petId) });
        return json({
          recordId: String(record._id),
          status: await healthRecords.statusFor(petId, userId),
        });
      }),
    }),

    betaTool({
      name: "mark_record_done",
      description:
        "Marks a repeating record (flea/tick, heartworm, medication) as given today: writes the next record from its interval and re-arms the reminder. A vaccine does not repeat and cannot be marked done.",
      inputSchema: object({ petId: { type: "string" }, recordId: { type: "string" } }, ["petId", "recordId"]),
      run: guard(async ({ petId, recordId }) => {
        const pet = await weights.ownPet(userId, petId, "owner name");
        const next = await healthRecords.markDone({ ownerId: userId, petId, recordId });
        done({
          kind: "markRecordDone",
          summary: `Marked ${next.label || next.kind} done for ${pet.name}; next due ${toISODate(next.expiresAt)}`,
          undo: { kind: "removeHealthRecord", petId: String(petId), recordId: String(next._id) },
        });
        return json({ nextRecordId: String(next._id), nextDue: toISODate(next.expiresAt) });
      }),
    }),

    betaTool({
      name: "remove_health_record",
      description: "Removes one health record the owner entered.",
      inputSchema: object({ petId: { type: "string" }, recordId: { type: "string" } }, ["petId", "recordId"]),
      run: guard(async ({ petId, recordId }) => {
        const pet = await weights.ownPet(userId, petId, "owner name");
        const removed = await healthRecords.removeRecord({ ownerId: userId, petId, recordId });
        done({
          kind: "removeHealthRecord",
          summary: `Removed ${removed.label || removed.kind} for ${pet.name}`,
        });
        return json({ removed: true });
      }),
    }),

    betaTool({
      name: "update_setting",
      description:
        "Changes account settings: playdateRange (miles, 0 = no limit), units.distance (mi|km), units.weight (lb|kg), discovery.* filters, privacy.* audiences, locationSharingEnabled, notificationsEnabled. Pass only the keys to change, nested as in my_settings.",
      inputSchema: object({ patch: { type: "object" } }, ["patch"]),
      run: guard(async ({ patch }) => {
        if (patch && Object.hasOwn(patch, "spot")) {
          return json({ error: "Spot's own settings are changed on the Settings screen, not here." });
        }
        const current = await User.findById(userId).select("discovery privacy units").lean();
        const update = settings.updateFor(patch, current ?? {});
        const previous = {};
        for (const path of Object.keys(update)) {
          previous[path] = path.split(".").reduce((node, key) => node?.[key], current ?? {}) ?? null;
        }
        await User.updateOne({ _id: userId }, { $set: update });
        done({
          kind: "updateSetting",
          summary: `Updated ${Object.keys(update).join(", ")}`,
          undo: { kind: "updateSetting", set: previous },
        });
        effects.push({ type: "link", chip: link("Settings") });
        return json({ updated: update });
      }),
    }),

    betaTool({
      name: "open_screen",
      description: `Offers the person a button to a screen in the app. Screens: ${Object.keys(SCREENS).join(", ")}. Pass the id the screen needs (petId, articleId, playdateId, orderId, locationId, userId) as value.`,
      inputSchema: object(
        {
          screen: { type: "string", enum: Object.keys(SCREENS) },
          value: { type: "string", description: "The id the screen reads, if it takes one" },
          label: { type: "string", maxLength: 40 },
        },
        ["screen"]
      ),
      run: guard(async ({ screen, value, label }) => {
        const chip = link(screen, value, label);
        if (!chip) return json({ error: `${screen} needs a ${SCREENS[screen]?.param}` });
        effects.push({ type: "link", chip });
        return json({ offered: chip });
      }),
    }),
  ];

  if (readChats) {
    tools.push(
      betaTool({
        name: "my_chats",
        description:
          "The owner's recent chats with other owners - which pets, who with, and the last few messages. Only available because the owner turned it on in Settings.",
        inputSchema: object({ limit: { type: "integer", minimum: 1, maximum: 10 } }),
        run: guard(async ({ limit }) => {
          const blockedIds = await blocking.blockedIdsFor(userId);
          const chats = await Chat.find({ participants: { $all: [userId], $nin: blockedIds } })
            .populate("participants", "username")
            .populate("pets", "name owner")
            .sort({ updatedAt: -1 })
            .limit(limit ?? 5)
            .lean();
          const result = [];
          for (const chat of chats) {
            const messages = await Message.find({ chat: chat._id, deleted: { $ne: true } })
              .sort({ timestamp: -1 })
              .limit(10)
              .select("contentText sender timestamp")
              .lean();
            result.push({
              chatId: String(chat._id),
              with: (chat.participants ?? [])
                .filter((person) => String(person._id) !== String(userId))
                .map((person) => person.username),
              pets: (chat.pets ?? []).map((pet) => ({
                name: pet.name,
                mine: String(pet.owner) === String(userId),
              })),
              messages: messages.reverse().map((message) => ({
                from: String(message.sender) === String(userId) ? "me" : "them",
                text: message.contentText ?? "",
                at: message.timestamp ? new Date(message.timestamp).toISOString() : null,
              })),
            });
          }
          return json({ chats: result });
        }),
      })
    );
  }

  return { tools, effects };
};

/** The write tools, so a test can insist each has a two-account case. */
const WRITE_TOOLS = [
  "log_weight",
  "remove_weight",
  "add_health_record",
  "mark_record_done",
  "remove_health_record",
  "update_setting",
];

module.exports = { toolsFor, WRITE_TOOLS };
