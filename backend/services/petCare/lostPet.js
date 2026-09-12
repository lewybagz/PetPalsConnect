/**
 * What to do in the first hours after a pet goes missing.
 *
 * A source-controlled table, like `emergency.js` and `picks.js`: it is not
 * user data, it changes about never, and it has to work with no network, no
 * location and no imported rows - the half of the app somebody needs while
 * standing in the street.
 *
 * Every step describes what published guidance says to do. There is no
 * broadcast, no map of lost pets and no alert to other users: that is a
 * different product, none of the apps surveyed ship one, and a feature that
 * implies a search party exists when it does not would be worse than this.
 *
 * The evidence behind step one is the reason this exists at all. About 45% of
 * US pets are microchipped and only around 60% of those chips carry a current
 * registration, so the single most useful thing most owners can do is check
 * the details on a chip they already have - before anything is lost.
 */

const LOST_PET_STEPS = [
  {
    id: "check-chip",
    title: "Check the microchip registration first",
    body:
      "A chip only works if the registry has a phone number that still reaches you. Look the number up in the registry's own database and confirm the details are current. If the chip was never registered, register it now - it is free at most registries and it is the step that returns pets.",
    source: {
      name: "American Animal Hospital Association universal chip lookup",
      url: "https://www.aaha.org/petmicrochiplookup/",
    },
  },
  {
    id: "search-close",
    title: "Search close to home, and at night",
    body:
      "Most cats and many frightened dogs are found within a few houses of home, hiding rather than travelling. Search sheds, under decks, in garages and in undergrowth, and go back after dark with a torch when it is quiet.",
    source: {
      name: "ASPCA, lost pet guidance",
      url: "https://www.aspca.org/pet-care/general-pet-care/lost-pet-guide",
    },
  },
  {
    id: "call-shelters",
    title: "Ring and then visit the local shelters",
    body:
      "File a lost report with every shelter and animal control office in your area, and go in person where you can - a description over the phone is not how a frightened, muddy animal gets recognised. Ask how often you should come back.",
    source: {
      name: "ASPCA, lost pet guidance",
      url: "https://www.aspca.org/pet-care/general-pet-care/lost-pet-guide",
    },
  },
  {
    id: "tell-vets",
    title: "Tell the vets and emergency clinics nearby",
    body:
      "Somebody who finds an injured animal takes it to the nearest clinic, not to a shelter. The care hub's vet list is a starting point for who to ring.",
    source: {
      name: "American Veterinary Medical Association",
      url: "https://www.avma.org/resources/pet-owners/petcare/microchipping-animals-faq",
    },
  },
  {
    id: "post-locally",
    title: "Post where neighbours actually look",
    body:
      "Local social media groups, the neighbourhood app and paper signs at eye level on the routes people walk. Use one clear photograph and a phone number, and say where the animal was last seen rather than where it lives.",
    source: {
      name: "ASPCA, lost pet guidance",
      url: "https://www.aspca.org/pet-care/general-pet-care/lost-pet-guide",
    },
  },
];

module.exports = { LOST_PET_STEPS };
