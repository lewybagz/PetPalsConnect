const { EMERGENCY_CONTACTS } = require("../petCare/emergency");

/**
 * The rich pieces a Spot answer carries beside its text, and the rules that
 * attach them.
 *
 * Pure. Tools record *effects* while the model works - "I looked up a toxin",
 * "I wrote a weigh-in", "open this screen" - and this turns the list of
 * effects into the blocks the app renders. Doing it here rather than asking
 * the model to emit them means the rules are mechanical: a toxin answer
 * carries the helpline numbers because `toxin_lookup` ran, not because the
 * prompt asked nicely.
 *
 * Three block types, kept small on purpose:
 * - `links`    - chips that `navigate()` to a registered screen with params
 * - `done`     - a write Spot made, with the undo where one exists
 * - `contacts` - the emergency numbers, as tappable cards
 */

/**
 * Screens Spot may send somebody to, by the name `AppStack` registers, with
 * the param each one reads. `spot.test.js` checks every entry against the
 * app's `AppStack.js` the way `types.test.js` checks notification
 * destinations - a chip that lands nowhere is the reachability failure this
 * repo keeps finding.
 */
const SCREENS = {
  PetDetails: { param: "petId", label: "Open pet" },
  PetHealth: { param: "petId", label: "Health records" },
  PetWeight: { param: "petId", label: "Weight history" },
  PetPhotos: { param: "petId", label: "Photos" },
  PetTracking: { param: "petId", label: "Tracking" },
  AddPet: { param: null, label: "Add a pet" },
  ToxinLookup: { param: null, label: "Is this dangerous?" },
  LostPet: { param: null, label: "Missing pet checklist" },
  Articles: { param: null, label: "Articles" },
  ArticleDetail: { param: "articleId", label: "Read article" },
  MyPlaydates: { param: null, label: "My playdates" },
  PlaydateDetails: { param: "playdateId", label: "Open playdate" },
  // `extra` names the params a prefilled form may carry; anything else is dropped.
  SchedulePlaydate: {
    param: "petId",
    label: "Plan a playdate",
    extra: ["myPetId", "locationId", "presetDate", "presetTime", "notes"],
  },
  Map: { param: null, label: "Nearby" },
  Chat: { param: "chatId", label: "Open chat" },
  Chats: { param: null, label: "Chats" },
  Profile: { param: null, label: "Your profile" },
  AccountInformation: { param: null, label: "Account" },
  LegalPolicies: { param: null, label: "Terms and privacy" },
  GroupChat: { param: "chatId", label: "Open group" },
  FriendsList: { param: null, label: "Pals" },
  FriendRequests: { param: null, label: "Friend requests" },
  Favorites: { param: null, label: "Saved" },
  PotentialPlaydateLocation: { param: "locationId", label: "Open place" },
  Shop: { param: null, label: "Shop" },
  Orders: { param: null, label: "Orders" },
  OrderDetail: { param: "orderId", label: "Open order" },
  Settings: { param: null, label: "Settings" },
  PrivacySettings: { param: null, label: "Privacy" },
  NotificationPreferences: { param: null, label: "Notifications" },
  DiscoveryPreferences: { param: null, label: "Discovery" },
  ChoosePlan: { param: null, label: "Premium" },
  HelpSupport: { param: null, label: "Help & support" },
  ReportUser: { param: "userId", label: "Report" },
  BlockedAccounts: { param: null, label: "Blocked accounts" },
};

/** A `links` chip, or null when the screen is not one Spot may open. */
const link = (screen, value, label, extra = {}) => {
  const entry = SCREENS[screen];
  if (!entry) return null;
  const params = entry.param && value != null ? { [entry.param]: String(value) } : {};
  if (entry.param && !params[entry.param]) return null;
  for (const key of entry.extra ?? []) {
    if (extra[key] != null && extra[key] !== "") params[key] = String(extra[key]);
  }
  return { screen, params, label: label || entry.label };
};

const key = (chip) => `${chip.screen}:${JSON.stringify(chip.params)}`;

/**
 * Effects to blocks.
 *
 * - Every `toxin` effect adds the contacts, once, whatever it found: a miss
 *   is an answer and it still ends at a phone number.
 * - A `contact` effect (a saved place with a phone) is its own contacts
 *   block with a title, so "your vet" is drawn calmly and the helpline red
 *   stays the helpline's.
 * - `link` effects are deduped and gathered into one `links` block.
 * - `web` effects (a retailer search from the picks table) are deduped by url
 *   into one `web` block, capped, and the app opens them in the browser.
 * - `card` effects (an article, a place, a pal's pet) are one `cards` block,
 *   capped, deduped by the chip they carry - and a plain chip for the same
 *   screen and params is dropped, so nothing is offered twice.
 * - Each `done` effect is its own block, in order. One with no `undo` is an
 *   action that reached another person and cannot be taken back.
 */
const WEB_LIMIT = 8;
const CARD_LIMIT = 6;

const blocksFrom = (effects = []) => {
  const blocks = [];
  const chips = new Map();
  const web = new Map();
  const cards = new Map();
  const own = new Map();
  let contacts = false;

  for (const effect of effects) {
    if (effect.type === "toxin") contacts = true;
    if (effect.type === "link" && effect.chip) chips.set(key(effect.chip), effect.chip);
    if (effect.type === "card" && effect.item?.chip && effect.item.title && cards.size < CARD_LIMIT) {
      cards.set(key(effect.item.chip), effect.item);
    }
    if (effect.type === "contact" && effect.item?.phone && effect.item.name) own.set(effect.item.id, effect.item);
    if (effect.type === "web" && effect.item?.url && web.size < WEB_LIMIT) web.set(effect.item.url, effect.item);
    if (effect.type === "done") {
      blocks.push({
        type: "done",
        kind: effect.kind,
        summary: effect.summary,
        undo: effect.undo ?? null,
      });
    }
  }

  for (const cardKey of cards.keys()) chips.delete(cardKey);
  if (cards.size > 0) blocks.push({ type: "cards", items: [...cards.values()] });
  if (chips.size > 0) blocks.push({ type: "links", items: [...chips.values()] });
  if (web.size > 0) blocks.push({ type: "web", items: [...web.values()] });
  if (own.size > 0) blocks.push({ type: "contacts", title: "Your saved places", items: [...own.values()] });
  if (contacts) blocks.push({ type: "contacts", items: EMERGENCY_CONTACTS });

  return blocks;
};

/**
 * Plain paragraphs only.
 *
 * There is no markdown renderer in the app - `ArticleDetailScreen` splits on
 * blank lines and that is the whole rendering model - so `**`, `##`, list
 * markers and link syntax would reach a device as literal characters. The
 * prompt asks for prose; this is the belt to that brace. Structure comes
 * from blocks, not from markup.
 */
const stripMarkdown = (text = "") =>
  String(text)
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1$2")
    .replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, "$1$2")
    // Horizontal whitespace only: `\s` would swallow the blank line before a
    // bullet and glue two paragraphs together.
    .replace(/^[ \t]{0,3}[-*+][ \t]+/gm, "")
    .replace(/^[ \t]{0,3}\d+\.[ \t]+/gm, "")
    .replace(/^[ \t]{0,3}>[ \t]?/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

module.exports = { SCREENS, link, blocksFrom, stripMarkdown };
