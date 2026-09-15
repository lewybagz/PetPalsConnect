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
  shop: "The shop and the collar",
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
  {
    id: "swipe-or-tap",
    topic: "discover",
    question: "Do I have to swipe?",
    answer:
      "No. Every card has Say hello and Keep browsing buttons that do exactly what a throw does, so the deck works with a screen reader or switch control. A throw commits at the moment the stamp on the card is fully showing; let go before that and the card settles back.",
    screen: "DiscoveryPreferences",
  },
  {
    id: "match-score",
    topic: "discover",
    question: "What is the match score?",
    answer:
      "Temperament and size lead, then shared activities, breed and age, all judged in dog terms: how two dogs are likely to play and whether one could hurt the other by accident. It compares the two pets, never the two owners. Show match score in display settings hides the number without changing the order.",
    screen: "DisplaySettings",
  },
  {
    id: "preview-mode",
    topic: "discover",
    question: "Why does Discover say Dogs near you instead of matches?",
    answer:
      "There is no dog on your profile to match from, so the deck is a browse: the same dogs, the same distance and block rules, no score and no deciding. Add a dog and the same deck becomes yours to decide on.",
    screen: "AddPet",
  },
  {
    id: "decided-once",
    topic: "discover",
    question: "Can I see a dog I passed on again?",
    answer:
      "No. What you decided is kept separately from what the matching thinks, so re-running the matching never puts someone you passed on back in front of you. A yes you gave is kept the same way, waiting for theirs.",
    screen: null,
  },
  {
    id: "discovery-filters",
    topic: "discover",
    question: "What can I narrow the deck by?",
    answer:
      "Weight, age, species, whether to include dogs whose owner has not shared a position, and whether to require shared vaccination records. Every one of them only narrows: none can put a dog in the deck that the block and range rules keep out, and a minimum above its maximum is refused rather than quietly emptying the deck.",
    screen: "DiscoveryPreferences",
  },
  {
    id: "unknown-distance",
    topic: "discover",
    question: "Why does a dog show no distance?",
    answer:
      "Its owner has never shared a position, so there is nothing to measure from. They stay in the deck without a distance rather than being dropped, because leaving them out would empty the deck for everyone early on. A discovery preference leaves them out if you prefer.",
    screen: "DiscoveryPreferences",
  },
  {
    id: "vaccination-pill",
    topic: "discover",
    question: "What does Vaccinations shared on a card mean?",
    answer:
      "The owner has entered rabies, DHPP and Bordetella records with dates that have not passed. It is owner-reported: what they typed, not something anyone checked. You can require it in discovery preferences; it is off to start because a preference that empties the deck is one nobody keeps.",
    screen: "DiscoveryPreferences",
  },
  {
    id: "waitlist",
    topic: "discover",
    question: "What does the waitlist do?",
    answer:
      "One email to the address on your account when playdates open in your area, and nothing else. The ZIP you gave when you made your profile is what says where demand is. Continue to my pets opens the half of the app that works anywhere: your pets, their records and reminders, the care hub and Spot.",
    screen: null,
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
  {
    id: "playdate-how",
    topic: "playdates",
    question: "How do I arrange a playdate?",
    answer:
      "From the other dog's page, or from a place. The screen asks only what it cannot already answer: which of your dogs is coming if you have more than one, where, and when, with a date and a time. The invitation reaches the other owner as a notification, and only they can accept it.",
    screen: "MyPlaydates",
  },
  {
    id: "playdate-change",
    topic: "playdates",
    question: "Can I change a playdate after sending it?",
    answer:
      "The organiser can, while it is still ahead: the date, the time, the place or the note. Only the organiser gets the edit screen; anyone on the playdate can cancel it. The place has to be one from the directory, the same as when it was created.",
    screen: "MyPlaydates",
  },
  {
    id: "playdate-review",
    topic: "playdates",
    question: "What is the review after a playdate?",
    answer:
      "An hour after the start time a notification asks how it went. A review is a star rating and a comment, and you choose whether it is public. Reviews of a place are readable by everyone, so the comment goes through the same language filter as a chat message.",
    screen: "PlaydateHistory",
  },
  {
    id: "playdate-history",
    topic: "playdates",
    question: "Where are my past playdates?",
    answer:
      "The Playdates tab shows what is still ahead; anything that has happened moves to playdate history so the tab never fills with the past.",
    screen: "PlaydateHistory",
  },
  {
    id: "playdate-notifications",
    topic: "playdates",
    question: "How am I told about playdates?",
    answer:
      "An invitation, an acceptance, a decline and a cancellation each arrive as a notification, and the review prompt afterwards. All of them are under the Playdates and reminders switch in notification preferences, which also covers vaccination and treatment reminders.",
    screen: "NotificationPreferences",
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
  {
    id: "become-pals",
    topic: "chats",
    question: "How do I become pals with someone?",
    answer:
      "Tap Become pals on their dog's card. The request goes to the owner as a notification, and if they accept, the friendship is between your dog and theirs, which is how the pals list shows it. Who may send you requests is a privacy setting: everyone, pals of pals, or nobody.",
    screen: "FriendRequests",
  },
  {
    id: "group-chats",
    topic: "chats",
    question: "Can I make a group chat?",
    answer:
      "Yes. Pick the pets in it, give it a name, and it appears on the Groups tab beside your chats. Muting a group silences its pushes for you alone, and Leave group is under its options. Nobody can remove anyone else from a group.",
    screen: "GroupChats",
  },
  {
    id: "chat-media-reactions",
    topic: "chats",
    question: "Can I send photos and react to messages?",
    answer:
      "Yes. Photos sent in a chat are collected under the chat's details, a message's menu offers a reply, a reaction and copy, and you can delete a message you sent. Reactions arrive as notifications under the Messages switch.",
    screen: "Chats",
  },
  {
    id: "language-filter",
    topic: "chats",
    question: "Why was my message refused?",
    answer:
      "It included language the app does not allow between users. Nothing is masked or changed: the message is not sent and you are asked to reword it. The same filter runs on group messages and on playdate reviews.",
    screen: "Chats",
  },
  {
    id: "not-available",
    topic: "chats",
    question: "What does not available mean when I try to message someone?",
    answer:
      "Either they have narrowed who can reach them, or one of you has blocked the other. The app gives the same words for both on purpose, so a refusal never tells anyone which it was.",
    screen: "PrivacySettings",
  },
  {
    id: "profile-visibility",
    topic: "chats",
    question: "Who can find my profile?",
    answer:
      "Privacy settings choose who can see your profile, whether username search finds you, and whether you appear on the map. Whatever you choose, a pet that is not a dog is never shown to other users at all.",
    screen: "PrivacySettings",
  },
  // --- Health records ----------------------------------------------------
  {
    id: "owner-reported",
    topic: "health",
    question: "What does owner-reported mean on a vaccination?",
    answer:
      "It means the owner typed the record in. PetPals does not check certificates, so the app never calls a pet safe or checked; it says what was entered and when. A daycare or boarder will still ask for the paperwork.",
    screen: "Profile",
  },
  {
    id: "current-vaccinations",
    topic: "health",
    question: "What counts as up to date?",
    answer:
      "Rabies, DHPP and Bordetella entered with dates that have not passed, following the 2022 AAHA guidelines. One of the three missing shows as partial; a passed date shows as expired. A record with no due date never lapses, because the app does not invent one.",
    screen: "Profile",
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
    screen: "Profile",
  },
  {
    id: "record-kinds",
    topic: "health",
    question: "What kinds of record can I keep?",
    answer:
      "Vaccines: rabies, DHPP, Bordetella, influenza, leptospirosis and other. Flea and tick, heartworm, vet visits and medications. And identification: a microchip and a licence. Each is a name and a date; a medication has no field for how much, on purpose, because that is your vet's instruction and not a thing to store.",
    screen: "Profile",
  },
  {
    id: "certificate-photo",
    topic: "health",
    question: "Can I attach the certificate?",
    answer:
      "Yes, a photo of it from your phone, stored with your other photos. A record with one shows as documented rather than typed. It is still not checked by anyone, and nothing in the app calls a record checked.",
    screen: "Profile",
  },
  {
    id: "medication-interval",
    topic: "health",
    question: "How does a treatment reminder repeat?",
    answer:
      "A repeating record starts with a common cycle filled in, which you change to what your vet prescribed; the app never chooses it. Marking a dose done writes the next record one interval on and sets its reminder, and the one you marked stays as history. A vaccine has a certificate date rather than a cycle, so it cannot be marked done.",
    screen: "Profile",
  },
  {
    id: "weight-tracking",
    topic: "health",
    question: "How does the weight chart work?",
    answer:
      "Each weigh-in is a dated entry in your units, and the newest one is the weight everyone sees on the card. Body condition is the published one to nine scale, entered by hand and never worked out from the number. The screen shows the trend and never names a target weight, a calorie figure or a diet; those are your vet's.",
    screen: "Profile",
  },
  {
    id: "weight-species",
    topic: "health",
    question: "Why isn't weight tracked for my bird or fish?",
    answer:
      "Only dogs and cats carry a weight on their profile, because weight is what the matching compares and what the food picks use. Other species have records, photos and Spot, and no weigh-in screen.",
    screen: "Profile",
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
    screen: "Profile",
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
  {
    id: "units",
    topic: "pets",
    question: "Can I use kilograms and kilometres?",
    answer:
      "Yes, under units in discovery preferences. Everything is stored one way underneath so two pets stay comparable; the setting changes only how numbers read, on the first frame, everywhere.",
    screen: "DiscoveryPreferences",
  },
  {
    id: "skip-pet",
    topic: "pets",
    question: "Do I have to add a pet to use the app?",
    answer:
      "No. The add-a-pet step can be skipped and the choice is remembered. Without one you can browse the deck, read the articles, use the poison lookup and the emergency numbers. Deciding on a dog, starting a chat about one and arranging a playdate all need a dog of your own.",
    screen: "AddPet",
  },
  {
    id: "photos-resized",
    topic: "pets",
    question: "Are my photos resized?",
    answer:
      "Yes, to 1280 pixels on the longest edge before upload, so a phone photo of several megabytes becomes a card-sized one and a deck of them loads quickly. The original stays on your phone untouched.",
    screen: "Profile",
  },
  {
    id: "pet-details",
    topic: "pets",
    question: "What does the app ask about a pet?",
    answer:
      "Name, species, breed, age, weight in your units, temperament, the activities they enjoy, photos and a special-needs note. Temperament, activities and weight are what the matching reads; the special-needs note is never used to pick a product and instead points the care hub at vets.",
    screen: "AddPet",
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
  {
    id: "emergency-numbers",
    topic: "care",
    question: "What are the emergency numbers?",
    answer:
      "The ASPCA Animal Poison Control Center on 888-426-4435 and the Pet Poison Helpline on 855-764-7661. Both are open around the clock, the helpline also covers Canada, and both may charge a consultation fee. They are on the care hub's emergency card and above the poison lookup's search box, and Spot gives them with any answer about something eaten.",
    screen: "ToxinLookup",
  },
  {
    id: "toxin-offline",
    topic: "care",
    question: "Does the poison lookup work without signal?",
    answer:
      "Yes. The table is kept on your phone and searched there, and refreshed from the server when it can be; an empty reply never replaces a good copy. The numbers sit above the search box so they are there before you type anything.",
    screen: "ToxinLookup",
  },
  {
    id: "care-places",
    topic: "care",
    question: "What places does the care hub know about?",
    answer:
      "Vets, pet shops, groomers and boarding near you, and for going out together, patios, hotels and trails. Those last three come from keyword searches and are labelled reported dog-friendly, because nothing checks them. A place's phone, website and hours load the first time you open it.",
    screen: null,
  },
  {
    id: "places-empty",
    topic: "care",
    question: "Why does the places list say there is nothing nearby?",
    answer:
      "It tells three things apart: the app does not know where you are, your area has not been added to the directory yet, or there is genuinely nothing of that kind in range. The screen says which. When your position is known and the list is empty, it tries once to import the area by itself.",
    screen: null,
  },
  {
    id: "save-place",
    topic: "care",
    question: "Can I save my vet?",
    answer:
      "Yes. Saving a place from the care list keeps it under Places in your favourites, and it comes back with the list whatever category or range is showing. Ask Spot to ring your vet and a saved place with a number becomes a card you can tap to dial.",
    screen: "Favorites",
  },
  {
    id: "destinations",
    topic: "care",
    question: "Can I look up places in a city I am visiting?",
    answer:
      "Yes, for the cities the directory covers: Phoenix, Tucson, Mesa, Gilbert, Chandler and Glendale. Pick one at the top of the places list and it stands in for your position. A city is only offered when it actually has places in it, so the list grows as the directory does.",
    screen: null,
  },
  {
    id: "articles",
    topic: "care",
    question: "Where do the articles come from?",
    answer:
      "PetPals writes them from published research: every article lists its sources and the date somebody last reviewed it, and a thin bit of evidence is called thin in the text. Health articles describe guidance and never prescribe, and each ends with a vet. Browse by topic or search, and the care hub suggests three per pet.",
    screen: "Articles",
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
  {
    id: "sign-in-methods",
    topic: "account",
    question: "How can I sign in?",
    answer:
      "With Google, with Apple, with a phone number, or with an email address and a password. PetPals stores no password of its own; Firebase handles signing in, and Sign-in and security shows which method your account uses.",
    screen: "SecuritySettings",
  },
  {
    id: "change-password",
    topic: "account",
    question: "How do I change my password?",
    answer:
      "Under Sign-in and security, if your account has one; changing it signs out every other device. Forgotten it: the same screen emails a reset link. An account that signs in with Google, Apple or a phone number has no password to change.",
    screen: "SecuritySettings",
  },
  {
    id: "change-username",
    topic: "account",
    question: "Can I change my username or email?",
    answer:
      "Username, yes, in account information: three to twenty letters, numbers or underscores, and it has to be free with capitals ignored. Email and sign-in method belong to how you sign in, so they are shown there and not edited.",
    screen: "AccountInformation",
  },
  {
    id: "age-terms",
    topic: "account",
    question: "Why did I have to confirm I am over 18?",
    answer:
      "The Terms are a contract with an adult, and the app arranges for strangers to meet in a park. The date you accepted is kept, because the Terms give thirty days from it to opt out of arbitration.",
    screen: "LegalPolicies",
  },
  {
    id: "suspended",
    topic: "account",
    question: "What happens if my account is suspended?",
    answer:
      "The app shows one screen in place of the usual ones. From it you can write to support, which reaches a person, or delete your account. It never says how many reports there were or who made them.",
    screen: null,
  },
  {
    id: "data-retention",
    topic: "account",
    question: "What is kept after I delete my account?",
    answer:
      "Reports and support messages for up to three years, and shop orders for seven, because a paid order is a tax record. Everything else goes with the account: pets, records, photos, chats, playdates, positions and Spot's conversations. The privacy policy's retention table is written from the same list the deletion runs.",
    screen: "LegalPolicies",
  },
  {
    id: "device-settings",
    topic: "account",
    question: "Why don't dark mode and text size follow me to another phone?",
    answer:
      "Theme, larger text and reduced motion are settings of the phone, not the account, so they never leave it; a switch that waited on a server would not feel instant. Everything else in settings lives on your account and follows you.",
    screen: "DisplaySettings",
  },
  {
    id: "tour-again",
    topic: "account",
    question: "How do I see the app tour again?",
    answer:
      "Settings has Show the app tour again. It forgets every tour you have seen, and each screen with one greets you again on your next visit.",
    screen: "Settings",
  },
  {
    id: "quiet-hours",
    topic: "account",
    question: "What are quiet hours?",
    answer:
      "A window, say ten at night to seven in the morning, during which pushes are held. It follows your phone's clock and wraps past midnight. Only the push is silenced: the notification is still written and waits in the list.",
    screen: "NotificationPreferences",
  },
  {
    id: "notification-switches",
    topic: "account",
    question: "Which notification switches are there?",
    answer:
      "Messages, new matches, playdates and reminders, friend requests, Spot's reminders, and everything else. Each governs a kind of push the server actually checks before sending. The row in your notification list is written either way.",
    screen: "NotificationPreferences",
  },
  {
    id: "support",
    topic: "account",
    question: "How do I reach a person?",
    answer:
      "Help and support has a message box. What you write is filed under your own account and email address, so it cannot be sent as anyone else, and a person reads it. Spot can send one for you in your words. Support messages are kept for up to three years.",
    screen: "HelpSupport",
  },
  {
    id: "subscription-cancel",
    topic: "account",
    question: "How do I cancel premium?",
    answer:
      "Through the store you bought it from: Manage on the subscription screen opens it. Cancelling turns renewal off and premium stays until the end of the period you paid for. Restore purchases on the plan screen brings a purchase back on a new phone.",
    screen: "SubscriptionManagement",
  },
  {
    id: "subscription-pending",
    topic: "account",
    question: "I paid and premium is not on yet.",
    answer:
      "The store reports the purchase to PetPals a moment after the receipt, so the app can lag it by a little; the confirmation screen says so. There is no need to buy again. If it stays off, Restore purchases on the plan screen asks the store again.",
    screen: "SubscriptionManagement",
  },
  {
    id: "location-sharing",
    topic: "account",
    question: "What does location sharing turn on?",
    answer:
      "Two things. The phone's permission, which the app explains before asking: other owners will see roughly where your dog is, and Not now means no without the phone being asked. And the location sharing switch in privacy settings, which is what lets matches see your neighbourhood on the map and lets a playdate you organise show its place.",
    screen: "PrivacySettings",
  },
  // --- The shop and the collar -----------------------------------------
  {
    id: "shop-how",
    topic: "shop",
    question: "How does buying from the shop work?",
    answer:
      "Buy on Stripe opens Stripe's secure checkout in your browser for the card, the address and the tax, then brings you back to the order in the app. Merchandise ships within the US. PetPals never sees your card, and the shop sells things that ship, never anything that unlocks part of the app.",
    screen: "Shop",
  },
  {
    id: "order-confirming",
    topic: "shop",
    question: "Why does my order say confirming?",
    answer:
      "Coming back from checkout proves you came back, not that the payment went through. Stripe tells PetPals a moment later and the order turns to paid. The screen waits up to ninety seconds, then says to check back rather than buy again.",
    screen: "Orders",
  },
  {
    id: "order-shipped",
    topic: "shop",
    question: "How do I know when an order ships?",
    answer:
      "A notification when it is marked shipped, and the order's status in Orders. Orders are kept for seven years after they are placed, because a paid order is a tax record, and that is true even after the account is deleted.",
    screen: "Orders",
  },
  {
    id: "collar-what",
    topic: "shop",
    question: "What does the tracking collar do?",
    answer:
      "It reports where it is, and the app shows where it last reported: on the pet's tracking screen with a trail and the battery, and on the map. Every position says how old it is, and one older than ten minutes is marked as stale. It is not a safety device and the app never calls it one.",
    screen: "Shop",
  },
  {
    id: "collar-register",
    topic: "shop",
    question: "How do I set up the collar?",
    answer:
      "Open your pet's page, then Tracking, and enter the serial printed inside the collar. It is registered to that pet. The phone itself never reports where the pet is, which is why the app asks for no background location permission.",
    screen: "Profile",
  },
  {
    id: "collar-share",
    topic: "shop",
    question: "Can a pal see where my dog is?",
    answer:
      "Only a pal you share with, for as long as you choose: a day unless you say otherwise and a week at most, and the share ends early if either of you blocks the other. Sharing again extends the same share rather than adding another. Positions are kept for thirty days and then removed.",
    screen: "Profile",
  },
  {
    id: "collar-vs-map",
    topic: "shop",
    question: "Why does the map show other dogs roughly and mine exactly?",
    answer:
      "Because who is asking is different. Other owners get the neighbourhood, rounded to about a kilometre, and never the door. You, and a pal you have shared with, get the collar's real position, because a lost dog needs metres.",
    screen: "Map",
  },
  {
    id: "tracking-unavailable",
    topic: "shop",
    question: "Why does tracking say not available?",
    answer:
      "The same quiet answer covers a pet with no collar, a share that has ended, and a pet that is not yours to see. No detail is given on purpose.",
    screen: null,
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
  {
    id: "spot-consent",
    topic: "spot",
    question: "Why does Spot ask before it starts?",
    answer:
      "Because what you type, and the pet details and records it reads to answer, are sent to Anthropic, the company whose AI Spot runs on. Nothing you say to Spot is shown to other users. Not now leaves the rest of the app exactly as it was.",
    screen: "Spot",
  },
  {
    id: "spot-voice",
    topic: "spot",
    question: "Can I talk to Spot?",
    answer:
      "Yes. The microphone listens through your phone and puts the words in the box. A question asked by voice is read back and the microphone re-arms, so a whole exchange can be hands-free; typing ends that. Read aloud uses your phone's own voice unless an AI voice has been set up on the server.",
    screen: "Spot",
  },
  {
    id: "spot-noticed",
    topic: "spot",
    question: "What is the Spot noticed card on Home?",
    answer:
      "The app, not the model, checking your own records for a few things worth a look: a lapsed, due or missing core vaccination, a flea or heartworm treatment due within a week, a weigh-in older than three months, an invitation waiting. Home shows the first as a card; tapping it opens Spot with the question ready. It does not count against your allowance.",
    screen: "Spot",
  },
  {
    id: "spot-undo",
    topic: "spot",
    question: "Can I undo something Spot did?",
    answer:
      "Yes. A weigh-in, a health record, a setting, a pet edit, a note and a reminder each show a done card with Undo. Anything Spot only opens the screen for was never done in the first place.",
    screen: "Spot",
  },
  {
    id: "spot-opens-screens",
    topic: "spot",
    question: "Why does Spot sometimes just open a screen?",
    answer:
      "Because the action is yours to take: sending an invitation, a message or a pal request, or anything with money in it. Spot fills in what it can, such as the dog and the place for a playdate, and hands over. A chip under an answer is the same thing offered without being asked.",
    screen: "Spot",
  },
  {
    id: "spot-conversations",
    topic: "spot",
    question: "Does Spot remember earlier conversations?",
    answer:
      "Recent conversations are listed in Spot's panel and can be reopened or deleted. A new one starts fresh apart from your notes, which go with every message. Within a conversation, the last twenty messages travel with each new one.",
    screen: "Spot",
  },
  {
    id: "spot-health-line",
    topic: "spot",
    question: "Why does every health answer end with a vet?",
    answer:
      "Because Spot describes published guidance and never prescribes: no doses, no amounts, no diagnosis. It is the rule the articles and the poison lookup follow, written once. For anything eaten or anything urgent it gives the helpline numbers first.",
    screen: "Spot",
  },
  {
    id: "spot-knows",
    topic: "spot",
    question: "What does Spot know about my pets?",
    answer:
      "Your pet list with species, breed, age and latest weight, whether each dog's vaccinations are current, your notes, your units and your local time go with every message. Records, weigh-ins, playdates, pals, saved places, orders, reminders and unread notifications it reads only when a question needs them.",
    screen: "Spot",
  },
  {
    id: "spot-free-answers",
    topic: "spot",
    question: "Which questions does Spot answer without using my allowance?",
    answer:
      "Ones the app can settle itself: whether a pet is due for anything, a pet's weight or age, logging a weigh-in in a plain sentence, the emergency numbers, a unit conversion, the poison lookup, opening a screen by name, and the noticed card. Those never reach the model. A question that needs the model counts, and the count is under the message box.",
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
