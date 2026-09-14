const client = require("./client");

/**
 * Which model a turn runs on. Software, and off until configured.
 *
 * `SPOT_MODEL` is the default (Opus). `SPOT_MODEL_LIGHT` is unset by default,
 * which makes this always answer the default; set to a cheaper model, a turn
 * goes light only when every one of these holds:
 *
 * - no photo (a photo of an animal or a packet is a health question);
 * - none of the health, poison, emergency, dose or symptom vocabulary;
 * - none of the verbs the write tools act on;
 * - no earlier turn in the conversation ran on the default model, so a
 *   light turn never inherits a health thread.
 *
 * The list errs towards the default: any doubt is Opus. The eval run on the
 * light model is the gate for switching it on.
 */

const HEALTH = new RegExp(
  "\\b(?:vet|vets|veterinar\\w*|sick|ill|unwell|hurt|pain|limp\\w*|vomit\\w*|throw(?:ing)? up|diarrh\\w*|bleed\\w*|blood|" +
    "lethargic|collapse\\w*|seizure\\w*|breath\\w*|bloat\\w*|rash|itch\\w*|scratch\\w*|lump|swell\\w*|fever|" +
    "cough\\w*|sneez\\w*|ear\\w*|eye\\w*|teeth|tooth|dental|paw|nail|skin|fur|coat|weight|weigh\\w*|calorie\\w*|diet|" +
    "food|feed\\w*|eat\\w*|ate|drank|drink\\w*|swallow\\w*|chew\\w*|poison\\w*|toxic|toxin\\w*|dangerous|safe|" +
    "emergency|helpline|dose|dosage|mg|ml|medic\\w*|pill\\w*|tablet\\w*|ibuprofen|paracetamol|tylenol|aspirin|" +
    "vaccin\\w*|shot\\w*|booster\\w*|rabies|dhpp|bordetella|flea\\w*|tick\\w*|heartworm|worm\\w*|parasite\\w*|" +
    "pregnan\\w*|heat|spay\\w*|neuter\\w*|surgery|symptom\\w*|diagnos\\w*|treat\\w*|infect\\w*|allerg\\w*|" +
    "chocolate|grape\\w*|raisin\\w*|xylitol|onion\\w*|garlic|lil(?:y|ies)|antifreeze)\\b",
  "i"
);

const WRITE = new RegExp(
  "\\b(?:log|logged|record|add|added|remember|forget|note|accept|decline|cancel|update|change|edit|rename|remove|delete|" +
    "mark|done|set|save|send|contact|support|schedule|plan|book|arrange|invite)\\b",
  "i"
);

const lightModel = () => process.env.SPOT_MODEL_LIGHT || "";

/**
 * `{ text, image, historyModels }` -> a model name.
 * `historyModels` are the models earlier assistant turns in the conversation ran on.
 */
const modelFor = ({ text = "", image = false, historyModels = [] } = {}) => {
  const heavy = client.model();
  const light = lightModel();
  if (!light || light === heavy) return heavy;
  if (image) return heavy;
  if (historyModels.some((model) => model === heavy)) return heavy;
  if (HEALTH.test(text) || WRITE.test(text)) return heavy;
  return light;
};

module.exports = { modelFor, HEALTH, WRITE, lightModel };
