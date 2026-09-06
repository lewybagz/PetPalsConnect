/**
 * Who a thing is about, when the answer should be a pet.
 *
 * This app arranges for two animals to meet, and it used to name the accounts
 * either side of that almost everywhere: an inbox row titled with a username,
 * a friends list of usernames, a playdate card whose headline was "Upcoming".
 * The owner is never hidden - you are meeting a stranger in a park and you
 * should know their name - but the pet is the subject and the owner is the
 * line underneath.
 *
 * One module, because the resolution is the same shape in five places and the
 * failure mode when it drifts is a screen that names a person again.
 */

/** The id of a populated document, a bare id, or nothing. */
const idOf = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value._id ? String(value._id) : null;
};

const same = (a, b) => Boolean(a) && Boolean(b) && String(a) === String(b);

/** The owner of a populated pet, as an id. */
export const ownerIdOf = (pet) => idOf(pet?.owner);

/**
 * The other pet in a one-to-one conversation.
 *
 * `chat.pets` holds both; the one that is not yours is the one the row is
 * about. Falls back to whichever pet is present when ownership cannot be
 * resolved - a half-populated chat should still show an animal rather than
 * reverting to a username.
 */
export const otherPet = (chat, myUserId) => {
  const pets = Array.isArray(chat?.pets) ? chat.pets.filter(Boolean) : [];
  if (pets.length === 0) return null;

  const theirs = pets.find((pet) => !same(ownerIdOf(pet), myUserId));
  return theirs ?? pets[0] ?? null;
};

/** Your own pet in a one-to-one conversation, when it is known. */
export const myPet = (chat, myUserId) => {
  const pets = Array.isArray(chat?.pets) ? chat.pets.filter(Boolean) : [];
  return pets.find((pet) => same(ownerIdOf(pet), myUserId)) ?? null;
};

/** The other participant - the person, for safety actions and the byline. */
export const otherParticipant = (chat, myUserId) =>
  (chat?.participants ?? []).find(
    (participant) => !same(idOf(participant), myUserId)
  ) ?? null;

/**
 * The friend's pet in a friendship row.
 *
 * `pet1`/`pet2` line up with `user1`/`user2`. Older friendships predate the
 * pets being recorded, so the owner's first pet is the fallback rather than a
 * username.
 */
export const friendPet = (friendship, myUserId) => {
  const mineIsUser1 = same(idOf(friendship?.user1), myUserId);
  const theirPet = mineIsUser1 ? friendship?.pet2 : friendship?.pet1;
  if (theirPet) return theirPet;

  const them = mineIsUser1 ? friendship?.user2 : friendship?.user1;
  return them?.pets?.[0] ?? null;
};

/** Your pet in a friendship row, for the same reasons. */
export const ownPetInFriendship = (friendship, myUserId) => {
  const mineIsUser1 = same(idOf(friendship?.user1), myUserId);
  return (mineIsUser1 ? friendship?.pet1 : friendship?.pet2) ?? null;
};

/** The first usable photo on a pet. */
export const petPhoto = (pet) =>
  (Array.isArray(pet?.photos) ? pet.photos.find(Boolean) : null) ?? null;

/**
 * The byline under a pet's name: who is bringing them.
 *
 * Deliberately not just the username. "with @alex" reads as a person
 * accompanying an animal, which is the relationship the app is describing,
 * and it keeps the owner legible without letting them take the headline.
 */
export const broughtBy = (user) => {
  const name = user?.username ?? user?.name ?? null;
  return name ? `with ${name}` : null;
};

/**
 * How to refer to the owner in a safety flow.
 *
 * `SafetyMenu` is about the person - you do not block a dog - and its callers
 * already settled on this phrasing on the Discover card and the chat header.
 * It is here so the other six callers say the same thing.
 */
export const ownerOf = (pet) => (pet?.name ? `${pet.name}'s owner` : "this person");
