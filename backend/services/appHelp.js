/**
 * How PetPals works, as a table in the source.
 *
 * The questions people ask about the app itself - why the deck is empty,
 * what premium changes, who can accept a playdate - each answered in plain
 * sentences with the screen that settles it. A table for the reasons
 * `picks.js` and `toxins.js` are: not user data, no admin console, and a
 * change to what the app says about itself should be a reviewed diff.
 *
 * Two readers: the help screen fetches it whole, and Spot searches it
 * through `how_petpals_works`. Every answer restates a rule that lives in
 * code; when the rule changes, the entry changes. No prices - the store
 * shows those - and never "verified" about a vaccination.
 */

const TOPICS = {
  discover: "Finding pals",
  playdates: "Playdates",
  chats: "Chats and pals",
  health: "Health records",
  pets: "Your pets",
  care: "The care hub",
  account: "Your account",
  spot: "Spot",
};

const HELP = [
  // --- Finding pals ------------------------------------------------------
  {
    id: "deck-empty-region",
    topic: "discover",
    question: "Why is my deck empty?",
    answer:
      "PetPals is open in Arizona first. Outside it your deck is honestly empty and you are on the waitlist for your area; the care hub, records and Spot all work anywhere. Inside Arizona, an empty deck usually means no dog on your profile, a tight range, or that you have already decided on everyone nearby.",
    screen: "DiscoveryPreferences",
  },
  {
    id: "deck-empty-species",
    topic: "discover",
    question: "Why can't my cat match with anyone?",
    answer:
      "Playdates are for dogs. Every other species is on your profile for the care hub: food and supply picks, a vet nearby, the poison lookup and Spot. Add a dog and the deck fills in.",
    screen: "AddPet",
  },
  {
    id: "what-is-a-match",
    topic: "discover",
    question: "What is a match?",
    answer:
      "A match is mutual or it is nothing. You say yes to a dog, its owner says yes to yours, and only then does either of you hear about it. One-sided interest is never shown to the other person.",
    screen: "Map",
  },
  {
    id: "premium",
    topic: "discover",
    question: "What does premium change?",
    answer:
      "Premium widens the deck: more dogs to meet and a wider range. It is bought through the App Store or Google Play, and the plan screen shows the price for your store. Nothing about your records, the care hub or Spot's basics is behind it, and Spot's daily allowance is larger with it.",
    screen: "ChoosePlan",
  },
  {
    id: "range",
    topic: "discover",
    question: "How far away are the dogs I see?",
    answer:
      "As far as your playdate range, set in discovery preferences. Zero means no limit. Other owners see roughly where you are, rounded to about a kilometre, never your exact position.",
    screen: "DiscoveryPreferences",
  },
  // --- Playdates ---------------------------------------------------------
  {
    id: "playdate-accept",
    topic: "playdates",
    question: "Who can accept a playdate?",
    answer:
      "Only the owner who was invited, and only once. The organiser cannot accept their own invitation. Declining tells the organiser straight away rather than leaving them waiting.",
    screen: "MyPlaydates",
  },
  {
    id: "playdate-cancel",
    topic: "playdates",
    question: "Can I cancel a playdate?",
    answer: "Yes. Open the playdate and choose Cancel. Everyone on it is told, with the reason if you give one.",
    screen: "MyPlaydates",
  },
  {
    id: "playdate-place-hidden",
    topic: "playdates",
    question: "Why is the meeting place hidden?",
    answer:
      "The organiser has location sharing turned off, so the app does not show where they chose. A playdate that simply never had a place says that instead.",
    screen: "MyPlaydates",
  },
  {
    id: "playdate-places",
    topic: "playdates",
    question: "Why are only parks and trails offered as places to meet?",
    answer:
      "A playdate is two dogs meeting, and a park or a trailhead is where that happens. Vets, shops, groomers and boarding are places you take a pet to, so they stay in the care hub.",
    screen: "Map",
  },
  // --- Chats and pals ----------------------------------------------------
  {
    id: "chat-between-pets",
    topic: "chats",
    question: "Why does a chat show a dog's name instead of a person's?",
    answer:
      "A conversation is between two pets, with the owner's name underneath. If either of you has more than one dog, the app asks which one the chat is about.",
    screen: "Chats",
  },
  {
    id: "who-can-message",
    topic: "chats",
    question: "Who can message me?",
    answer:
      "Everyone, only matches, or only pals - your choice in privacy settings. Someone kept out is told you are not available, never that you restricted them.",
    screen: "PrivacySettings",
  },
  {
    id: "blocking",
    topic: "chats",
    question: "What does blocking do?",
    answer:
      "It works both ways. Every pet of theirs leaves your deck, they cannot open a chat with you or send a request, and neither of you appears in the other's search. Reporting someone blocks them at the same time. Blocked accounts are listed in settings, where a block can be undone.",
    screen: "BlockedAccounts",
  },
  {
    id: "reporting",
    topic: "chats",
    question: "How do I report someone?",
    answer:
      "Use Report on their card or in the chat header. It files the report and blocks them in one step, so you do not have to keep looking at the reason. Three separate reports hide an account automatically while it is looked at.",
    screen: "BlockedAccounts",
  },
  // --- Health records ----------------------------------------------------
  {
    id: "owner-reported",
    topic: "health",
    question: "What does owner-reported mean on a vaccination?",
    answer:
      "It means the owner typed the record in. PetPals does not check certificates, so the app never calls a pet safe or checked; it says what was entered and when. A daycare or boarder will still ask for the paperwork.",
    screen: "PetHealth",
  },
  {
    id: "current-vaccinations",
    topic: "health",
    question: "What counts as up to date?",
    answer:
      "Rabies, DHPP and Bordetella entered with dates that have not passed, following the 2022 AAHA guidelines. One of the three missing shows as partial; a passed date shows as expired. A record with no due date never lapses, because the app does not invent one.",
    screen: "PetHealth",
  },
  {
    id: "health-reminders",
    topic: "health",
    question: "When do vaccination and treatment reminders arrive?",
    answer:
      "Thirty days before a due date, as a notification. Flea, tick, heartworm and medication records repeat: marking one done writes the next one from its interval and sets the next reminder. The switch for these is in notification preferences.",
    screen: "NotificationPreferences",
  },
  {
    id: "microchip",
    topic: "health",
    question: "Where do I keep my pet's microchip number?",
    answer:
      "In health records, as a microchip entry. It sits above the missing-pet checklist, where the first step is checking the registration is current.",
    screen: "PetHealth",
  },
  // --- Your pets ---------------------------------------------------------
  {
    id: "other-species",
    topic: "pets",
    question: "Can I add a cat, a rabbit or a bird?",
    answer:
      "Yes. Any pet goes on your profile for records, weigh-ins, picks and Spot. Only dogs are shown to other owners or matched for playdates.",
    screen: "AddPet",
  },
  {
    id: "photos",
    topic: "pets",
    question: "How many photos can a pet have?",
    answer: "Six. The first one is the face everyone sees on cards and in chats; drag to reorder on the photos screen.",
    screen: "PetPhotos",
  },
  {
    id: "edit-pet",
    topic: "pets",
    question: "How do I change my pet's profile?",
    answer: "Open the pet from your profile and tap Edit. Weight is logged as a weigh-in on the weight screen, so the chart keeps its history.",
    screen: "Profile",
  },
  {
    id: "delete-pet",
    topic: "pets",
    question: "How do I remove a pet?",
    answer:
      "From the pet's own page. Its records, weigh-ins and photos go with it, which is why the app asks first and Spot never does it for you.",
    screen: "Profile",
  },
  // --- The care hub ------------------------------------------------------
  {
    id: "toxin-amount",
    topic: "care",
    question: "Why won't the poison lookup tell me how much is dangerous?",
    answer:
      "Because the amount is exactly the judgement the helpline exists to make, with the pet's size and the product in front of them. The lookup says whether something is an emergency, a call or one to avoid, and puts the numbers above the search box. A miss is not reassurance: call anyway.",
    screen: "ToxinLookup",
  },
  {
    id: "picks",
    topic: "care",
    question: "Are the food and supply picks sponsored?",
    answer:
      "No. They are categories of thing to look for - a puppy food, a slow feeder - chosen from your pet's species, age and size, each with a plain search link. PetPals is not paid for them. If a pet has a special-needs note, the hub shows vets instead of products.",
    screen: null,
  },
  {
    id: "insurance",
    topic: "care",
    question: "Is the insurance card an advert?",
    answer:
      "When there is a partner, the card says who it opens and that PetPals may be paid, right next to the link. No partner, no card.",
    screen: null,
  },
  {
    id: "lost-pet",
    topic: "care",
    question: "What happens if my pet goes missing?",
    answer:
      "The missing-pet checklist puts your recorded microchip numbers above the steps, because the first step is checking the registration. There is no alert to other users: a feature that implies a search party exists when it does not would be worse than the honest checklist.",
    screen: "LostPet",
  },
  // --- Your account ------------------------------------------------------
  {
    id: "delete-account",
    topic: "account",
    question: "How do I delete my account?",
    answer:
      "From account settings, in the app. Your profile, pets, records, photos, chats and playdates go. Reports, support messages and shop orders are kept for a fixed time, as the privacy policy says, and Spot never deletes an account for you.",
    screen: "AccountInformation",
  },
  {
    id: "location-privacy",
    topic: "account",
    question: "Who can see where I am?",
    answer:
      "Matches see roughly where you are on the map, rounded to about a kilometre. Your exact position never leaves the server. Turn the map off, or location sharing off, in privacy settings.",
    screen: "PrivacySettings",
  },
  {
    id: "legal",
    topic: "account",
    question: "Where are the Terms and the privacy policy?",
    answer:
      "In settings under legal policies, hosted so they cannot drift from the store listings. The Terms cover what the app is and is not; the privacy policy lists what is collected, who processes it and how long it is kept.",
    screen: "LegalPolicies",
  },
  {
    id: "notifications",
    topic: "account",
    question: "How do I quieten notifications?",
    answer:
      "Notification preferences has a switch per kind and quiet hours. Muting a chat silences its pushes without hiding its messages.",
    screen: "NotificationPreferences",
  },
  // --- Spot --------------------------------------------------------------
  {
    id: "spot-what",
    topic: "spot",
    question: "What can Spot do?",
    answer:
      "Answer questions about your pets from your own records and PetPals' articles, look up poisons, find vets nearby, log weigh-ins and health records, edit a pet, remember things you tell it, set reminders, answer playdate invitations you received, and explain how the app works. It is not a vet and always points you to one.",
    screen: "Spot",
  },
  {
    id: "spot-never",
    topic: "spot",
    question: "What will Spot never do?",
    answer:
      "Message other owners, send invitations or friend requests, block or report anyone, delete a pet or your account, or touch orders and subscriptions. For those it opens the screen and you decide.",
    screen: "Spot",
  },
  {
    id: "spot-quota",
    topic: "spot",
    question: "How many questions can I ask Spot?",
    answer:
      "A few a day free, more with premium; the count is under the message box. Questions the app can answer on its own, like whether a pet is due or what the emergency numbers are, do not count.",
    screen: "ChoosePlan",
  },
  {
    id: "spot-photos",
    topic: "spot",
    question: "What happens to a photo I send Spot?",
    answer:
      "It is sent once, to generate the answer, and not kept anywhere. Spot describes what is visible and never names a condition.",
    screen: "Spot",
  },
  {
    id: "spot-notes",
    topic: "spot",
    question: "What are Spot's notes?",
    answer:
      "Things you asked it to remember, in your words, kept as a short list you can see and delete. They go with every message you send it.",
    screen: "Spot",
  },
  {
    id: "spot-reminders",
    topic: "spot",
    question: "Can Spot remind me of things?",
    answer:
      "Yes. Say when, and it sends a notification then, once or daily, weekly or monthly; a day with no time is nine in the morning. Reminders are listed in Spot's panel, where each one can be cancelled, and their switch is in notification preferences.",
    screen: "Spot",
  },
  {
    id: "spot-chats",
    topic: "spot",
    question: "Can Spot read my chats?",
    answer:
      "Only if you turn that on in privacy settings. It is off to start, because the other person in a chat has not agreed to their words going to the assistant's provider.",
    screen: "PrivacySettings",
  },
  {
    id: "spot-wrong",
    topic: "spot",
    question: "What if Spot gets something wrong?",
    answer:
      "Tap the line under the answer to report it; somebody reads every report. And for anything about a pet's health, the answer to check against is your vet's.",
    screen: "Spot",
  },
];

const STOP = new Set(["the", "a", "an", "is", "it", "my", "i", "to", "of", "do", "does", "can", "how", "what", "why", "in", "on", "for", "and", "or", "me", "with", "are", "be", "s"]);

const tokens = (text) =>
  String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOP.has(word));

const INDEX = HELP.map((entry) => ({
  entry,
  question: new Set(tokens(entry.question)),
  body: new Set(tokens(`${entry.answer} ${TOPICS[entry.topic]}`)),
}));

/**
 * Word overlap: a question word counts double. The best `limit` entries with
 * any overlap at all, best first; nothing for a query with no words in common.
 */
const search = (query, limit = 5) => {
  const words = tokens(query);
  if (words.length === 0) return [];
  return INDEX.map(({ entry, question, body }) => ({
    entry,
    score: words.reduce((sum, word) => sum + (question.has(word) ? 2 : 0) + (body.has(word) ? 1 : 0), 0),
  }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.question.localeCompare(b.entry.question))
    .slice(0, limit)
    .map((row) => row.entry);
};

const all = () => HELP;

module.exports = { HELP, TOPICS, all, search, tokens };
