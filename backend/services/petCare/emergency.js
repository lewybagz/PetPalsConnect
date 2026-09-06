/**
 * The numbers somebody needs when something has gone wrong.
 *
 * This is a source-controlled table rather than a collection, for the same
 * reason `notificationTypes.js` and `reportStates.js` are: it is not user data,
 * it changes about never, there is no admin console in this repo to edit it
 * from, and changing an emergency phone number ought to be a reviewed diff
 * rather than a POST somebody makes at midnight.
 *
 * It is also the one part of the care hub that works with nothing: no shared
 * location, no `GOOGLE_MAPS_API_KEY`, no imported rows. A hub whose whole
 * content depends on an optional integration shows an empty screen on every
 * fresh deployment, and this is the half that must always be there - it is
 * also the half somebody needs most urgently.
 *
 * `region` is on every entry because these are US and Canada services and the
 * app does not ask anybody where they live. Saying so is better than showing a
 * number that does not connect: the screen labels them rather than implying
 * they are universal.
 */

const EMERGENCY_CONTACTS = [
  {
    id: "aspca-apcc",
    name: "ASPCA Animal Poison Control Center",
    phone: "888-426-4435",
    region: "US",
    // Both of these charge a consultation fee, and finding that out at the end
    // of the call is not something to leave to chance.
    note: "24/7. A consultation fee may apply.",
    url: "https://www.aspca.org/pet-care/animal-poison-control",
  },
  {
    id: "pet-poison-helpline",
    name: "Pet Poison Helpline",
    phone: "855-764-7661",
    region: "US and Canada",
    note: "24/7. A consultation fee may apply.",
    url: "https://www.petpoisonhelpline.com",
  },
];

module.exports = { EMERGENCY_CONTACTS };
