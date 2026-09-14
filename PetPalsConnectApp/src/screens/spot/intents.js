import {
  distanceFromMiles,
  distanceToMiles,
  weightToPounds,
  weightFromPounds,
  weightLabel,
} from "../../utils/units";
import { describeForOwner } from "../../api/health";
import { searchToxins, SEVERITY_LABELS, SEVERITY_BLURBS } from "../../api/toxins";

/**
 * Software first, model second.
 *
 * Every message the person types goes through this before anything is sent
 * to the server. The questions people ask the same way every time - "is
 * Bella due for anything", "log her at 42 pounds", "emergency numbers",
 * "she ate grapes" - are answered here, in Spot's voice, from data the app
 * already holds. No model turn, no quota, works offline. What this cannot
 * answer falls through to the model.
 *
 * Pure: `resolveIntent` reads text and context and returns a description of
 * what to do; the screen does the doing. `answer*` build the message that
 * gets shown. Both are tested without a renderer.
 *
 * ponytail: five regexes over English. A second language or a tenth pattern
 * is the point to reconsider, not before.
 */

const clean = (text = "") => String(text).trim().replace(/\s+/g, " ");

/** The pet named in the text, or the only pet, or null. */
const petFrom = (text, pets = []) => {
  const lower = text.toLowerCase();
  const named = pets.filter((pet) => pet?.name && lower.includes(pet.name.toLowerCase()));
  if (named.length === 1) return named[0];
  if (named.length === 0 && pets.length === 1) return pets[0];
  return null;
};

/** Where "open X" goes. Keys are what people type; values are AppStack routes. */
const OPENABLE = {
  settings: "Settings",
  privacy: "PrivacySettings",
  notifications: "NotificationPreferences",
  discovery: "DiscoveryPreferences",
  shop: "Shop",
  orders: "Orders",
  articles: "Articles",
  playdates: "MyPlaydates",
  map: "Map",
  nearby: "Map",
  premium: "ChoosePlan",
  help: "HelpSupport",
  support: "HelpSupport",
  "lost pet": "LostPet",
  "missing pet": "LostPet",
  toxins: "ToxinLookup",
  poison: "ToxinLookup",
  pals: "FriendsList",
  friends: "FriendsList",
  "friend requests": "FriendRequests",
  favourites: "Favorites",
  favorites: "Favorites",
  saved: "Favorites",
  chats: "Chats",
  messages: "Chats",
  profile: "Profile",
};

/** Screens that need a pet, by the word people use for them. */
const PET_SCREENS = {
  health: "PetHealth",
  records: "PetHealth",
  vaccinations: "PetHealth",
  weight: "PetWeight",
  photos: "PetPhotos",
  tracking: "PetTracking",
  collar: "PetTracking",
};

const WEIGHT = /\b(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kgs?|kilos?|kilograms?)?\b/i;
const LOG_WEIGHT = /^(?:log|record|weigh(?:ed)?|add|put|set)\b.*\b(?:weight|weighs?|at|lbs?|pounds?|kgs?|kilos?|kilograms?)\b/i;
const EMERGENCY =
  /\b(?:emergency|poison|helpline)\b.*\b(?:number|numbers|phone|line|hotline|contact)s?\b|\bwho (?:do|should|can) i (?:call|ring|phone)\b/i;
const DUE = /\b(?:due|up to date|up-to-date|current|vaccin\w*|shots?|boosters?)\b/i;
const OPEN = /^(?:open|go to|show(?: me)?|take me to|where (?:is|are))\s+(?:my |the )?(.+?)[.?!]*$/i;
// "my orders", bare: only an exact screen word, or "my dog just ate..." is swallowed.
const MINE = /^my\s+(.+?)[.?!]*$/i;
const FACT_WEIGHT = /\bhow (?:much|heavy) (?:does|is) (.+?) weigh\b|\bwhat(?:'s| is) (.+?)(?:'s)? weight\b/i;
const FACT_AGE = /\bhow old is (.+?)[.?!]*$|\bwhat(?:'s| is) (.+?)(?:'s)? age\b/i;
const UNIT = "lbs?|pounds?|kgs?|kilos?|kilograms?|mi|miles?|km|kilomet(?:re|er)s?";
const CONVERT = new RegExp(
  `^(?:what(?:'s| is)\\s+|convert\\s+)?(\\d+(?:\\.\\d+)?)\\s*(${UNIT})\\s+(?:in|to|into)\\s+(${UNIT})\\b`,
  "i"
);

const unitOf = (word = "") => {
  const w = word.toLowerCase();
  if (w.startsWith("lb") || w.startsWith("pound")) return "lb";
  if (w.startsWith("k") && !w.startsWith("km") && !w.startsWith("kilom")) return "kg";
  if (w.startsWith("mi")) return "mi";
  return "km";
};
// Past tense only: "ate grapes" is an incident, "eats grass" is a habit and a
// question for the model.
const ATE = /\b(?:ate|eaten|swallowed|chewed|licked|got into|drank|nibbled)\s+(?:a |an |some |the |my |his |her |their |on )?(.+?)(?:\s+(?:is|was|it|this|that|earlier|today|yesterday|last night|just now)\b.*)?[.?!]*$/i;
const DANGEROUS =
  /\b(?:is|are|was)\s+(.+?)\s+(?:dangerous|toxic|poisonous|bad|safe|ok|okay|harmful)\b(?:\s+for\b.*)?[.?!]*$/i;

/**
 * What the text means, if software can answer it.
 *
 * Returns one of:
 *   { kind: "weight", pet, pounds }
 *   { kind: "due", pet }
 *   { kind: "emergency" }
 *   { kind: "open", screen, params }
 *   { kind: "toxin", query }
 * or null when the model should have it.
 */
export const resolveIntent = (rawText, { pets = [], units } = {}) => {
  const text = clean(rawText);
  if (!text) return null;

  if (EMERGENCY.test(text)) return { kind: "emergency" };

  const convert = text.match(CONVERT);
  if (convert) {
    const from = unitOf(convert[2]);
    const to = unitOf(convert[3]);
    const weightPair = ["lb", "kg"].includes(from) && ["lb", "kg"].includes(to);
    const distancePair = ["mi", "km"].includes(from) && ["mi", "km"].includes(to);
    if (from !== to && (weightPair || distancePair)) {
      return { kind: "convert", value: Number(convert[1]), from, to };
    }
    return null;
  }

  const weightFact = text.match(FACT_WEIGHT);
  if (weightFact) {
    const pet = petFrom(text, pets);
    return pet && pet.weight != null ? { kind: "fact", pet, fact: "weight" } : null;
  }
  const ageFact = text.match(FACT_AGE);
  if (ageFact) {
    const pet = petFrom(text, pets);
    return pet && pet.age != null ? { kind: "fact", pet, fact: "age" } : null;
  }

  if (LOG_WEIGHT.test(text)) {
    const match = text.match(WEIGHT);
    const pet = petFrom(text, pets);
    if (match && pet) {
      const value = Number(match[1]);
      const unitWord = (match[2] ?? "").toLowerCase();
      const unit = unitWord
        ? unitWord.startsWith("k")
          ? "kg"
          : "lb"
        : units?.weight ?? "lb";
      const pounds = Math.round(weightToPounds(value, unit) * 10) / 10;
      if (pounds > 0 && pounds <= 400) return { kind: "weight", pet, pounds, unit };
    }
    return null;
  }

  const mine = text.match(MINE);
  const bare = mine && OPENABLE[mine[1].toLowerCase()];
  if (bare) return { kind: "open", screen: bare, params: {} };

  const open = text.match(OPEN);
  if (open) {
    const what = open[1].toLowerCase();
    for (const [word, screen] of Object.entries(PET_SCREENS)) {
      if (what.includes(word)) {
        const pet = petFrom(text, pets);
        return pet ? { kind: "open", screen, params: { petId: String(pet._id) } } : null;
      }
    }
    for (const [word, screen] of Object.entries(OPENABLE)) {
      if (what.includes(word)) return { kind: "open", screen, params: {} };
    }
    return null;
  }

  if (DUE.test(text) && /\?|\b(?:is|are|when|any|what)\b/i.test(text)) {
    const pet = petFrom(text, pets);
    if (pet) return { kind: "due", pet };
    return null;
  }

  const ate = text.match(ATE) ?? text.match(DANGEROUS);
  if (ate) {
    const query = clean(ate[1]).replace(/^(?:a|an|some|the|my)\s+/i, "");
    if (query && query.length <= 60) return { kind: "toxin", query };
  }

  return null;
};

// ---------------------------------------------------------------------------
// Answers, in Spot's voice
// ---------------------------------------------------------------------------

const message = (text, blocks = []) => ({
  _id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role: "assistant",
  text,
  blocks,
  attachments: [],
  source: "software",
  createdAt: new Date().toISOString(),
});

const links = (items) => ({ type: "links", items });

export const answerDue = (pet, status) =>
  message(
    `${pet.name}: ${describeForOwner(status)}`,
    [links([{ screen: "PetHealth", params: { petId: String(pet._id) }, label: "Health records" }])]
  );

export const answerEmergency = (contacts = []) =>
  message(
    contacts.length
      ? "Here are the numbers. Both lines are open around the clock and may charge a consultation fee."
      : "Ring your vet, or the nearest emergency clinic.",
    contacts.length ? [{ type: "contacts", items: contacts }] : []
  );

/** After the weigh-in has been saved through `addWeight`. */
export const answerWeight = (pet, entry, units) => {
  const shown = weightFromPounds(entry.pounds, units?.weight ?? "lb");
  const rounded = Math.round(shown * 10) / 10;
  return message(`Logged ${pet.name} at ${rounded} ${weightLabel(units)}.`, [
    {
      type: "done",
      kind: "logWeight",
      summary: `Logged ${pet.name} at ${rounded} ${weightLabel(units)}`,
      undo: { kind: "removeWeight", petId: String(pet._id), entryId: String(entry._id) },
    },
    links([{ screen: "PetWeight", params: { petId: String(pet._id) }, label: "Weight history" }]),
  ]);
};

export const answerOpen = (screen, params, label) =>
  message("Here you go.", [links([{ screen, params, label: label ?? screen }])]);

/** A fact straight off the profile: the weight the app holds, or the age. */
export const answerFact = (pet, fact, units) => {
  if (fact === "weight") {
    const shown = Math.round(weightFromPounds(pet.weight, units?.weight ?? "lb") * 10) / 10;
    return message(`${pet.name} weighs ${shown} ${weightLabel(units)}, as of the last weigh-in.`, [
      links([{ screen: "PetWeight", params: { petId: String(pet._id) }, label: "Weight history" }]),
    ]);
  }
  return message(`${pet.name} is ${pet.age} ${pet.age === 1 ? "year" : "years"} old.`, [
    links([{ screen: "PetDetails", params: { petId: String(pet._id) }, label: `Open ${pet.name}` }]),
  ]);
};

/** Arithmetic is software's. */
export const answerConvert = ({ value, from, to }) => {
  const result =
    from === "lb" || from === "kg"
      ? weightFromPounds(weightToPounds(value, from), to)
      : distanceFromMiles(distanceToMiles(value, from), to);
  return message(`${value} ${from} is ${Math.round(result * 10) / 10} ${to}.`);
};

/**
 * An exact hit in the cached poison table, said the way the toxin screen
 * says it, with the numbers attached. Returns null on a miss - a miss goes to
 * the model, which has the table too and can reason about a fuzzy name.
 */
export const answerToxin = (query, toxins = [], contacts = []) => {
  const [hit] = searchToxins(toxins, query);
  if (!hit) return null;
  const text = [
    `${hit.name}: ${SEVERITY_LABELS[hit.severity] ?? hit.severity}. ${SEVERITY_BLURBS[hit.severity] ?? ""}`.trim(),
    hit.signs ? `What it looks like: ${hit.signs}` : null,
    hit.guidance ? `What the guidance says: ${hit.guidance}` : null,
    "This is what published guidance says, not a judgement about your pet. The helpline can weigh the details with you.",
  ]
    .filter(Boolean)
    .join("\n\n");
  return message(text, [
    { type: "contacts", items: contacts },
    links([{ screen: "ToxinLookup", params: {}, label: "Is this dangerous?" }]),
  ]);
};

/** The chips on the empty screen. Each is a real question this file answers. */
export const chipsFor = (pets = [], context = null) => {
  const pet =
    (context?.petId && pets.find((p) => String(p._id) === String(context.petId))) || pets[0];
  const name = pet?.name;
  const first = {
    health: name ? `Is ${name} due for anything?` : null,
    weight: name ? `Log a weigh-in for ${name}` : null,
    pet: name ? `Tell me about ${name}'s records` : null,
    article: "Sum this up for my pet",
    toxin: "My pet ate something",
    playdate: "Reply to this playdate",
    order: "Where is my order?",
    tracking: name ? `Where was ${name} last seen?` : null,
    chat: "What did we last talk about?",
  }[context?.screen];
  return [
    ...new Set(
      [
        first,
        name ? `Is ${name} due for anything?` : null,
        "Emergency numbers",
        "My pet ate something",
        name ? `What should I know about a ${pet.breed || pet.species || "dog"}?` : "What should I know about a new dog?",
      ].filter(Boolean)
    ),
  ].slice(0, 4);
};
