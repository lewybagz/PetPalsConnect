import {
  otherPet,
  myPet,
  otherParticipant,
  friendPet,
  ownPetInFriendship,
  petPhoto,
  broughtBy,
  ownerOf,
} from "./petIdentity";

const ME = "user-me";
const THEM = "user-them";

const bo = { _id: "pet-bo", name: "Bo", owner: ME, photos: ["bo.jpg"] };
const sky = { _id: "pet-sky", name: "Sky", owner: THEM, photos: [null, "sky.jpg"] };

describe("otherPet", () => {
  it("picks the pet that is not yours, whichever order they arrive in", () => {
    expect(otherPet({ pets: [bo, sky] }, ME).name).toBe("Sky");
    expect(otherPet({ pets: [sky, bo] }, ME).name).toBe("Sky");
  });

  it("works from the other side too", () => {
    expect(otherPet({ pets: [bo, sky] }, THEM).name).toBe("Bo");
  });

  it("falls back to whichever pet is there rather than to nothing", () => {
    // A half-populated chat should still show an animal. Returning null here
    // is what sent the inbox row back to titling itself with a username.
    expect(otherPet({ pets: [{ _id: "p", name: "Nell" }] }, ME).name).toBe("Nell");
  });

  it("survives a chat with no pets", () => {
    expect(otherPet({}, ME)).toBeNull();
    expect(otherPet({ pets: [] }, ME)).toBeNull();
    expect(otherPet(null, ME)).toBeNull();
  });

  it("tolerates an owner arriving as a populated document", () => {
    const populated = { _id: "pet-sky", name: "Sky", owner: { _id: THEM } };
    expect(otherPet({ pets: [bo, populated] }, ME).name).toBe("Sky");
  });
});

describe("myPet", () => {
  it("finds yours, and nothing when it is not there", () => {
    expect(myPet({ pets: [bo, sky] }, ME).name).toBe("Bo");
    expect(myPet({ pets: [sky] }, ME)).toBeNull();
  });
});

describe("otherParticipant", () => {
  it("is the person who is not you", () => {
    const chat = { participants: [{ _id: ME }, { _id: THEM, username: "alex" }] };
    expect(otherParticipant(chat, ME).username).toBe("alex");
  });

  it("handles bare ids", () => {
    expect(otherParticipant({ participants: [ME, THEM] }, ME)).toBe(THEM);
  });
});

describe("friendPet", () => {
  const friendship = { user1: { _id: ME }, user2: { _id: THEM }, pet1: bo, pet2: sky };

  it("gives you their pet from either side of the pair", () => {
    expect(friendPet(friendship, ME).name).toBe("Sky");
    expect(friendPet(friendship, THEM).name).toBe("Bo");
  });

  it("falls back to their first pet on a friendship written before pets", () => {
    const legacy = {
      user1: { _id: ME },
      user2: { _id: THEM, pets: [{ _id: "p", name: "Nell" }] },
    };
    expect(friendPet(legacy, ME).name).toBe("Nell");
  });

  it("returns null rather than a username when there is nothing", () => {
    expect(friendPet({ user1: { _id: ME }, user2: { _id: THEM } }, ME)).toBeNull();
  });

  it("ownPetInFriendship is the mirror of it", () => {
    expect(ownPetInFriendship(friendship, ME).name).toBe("Bo");
    expect(ownPetInFriendship(friendship, THEM).name).toBe("Sky");
  });
});

describe("petPhoto", () => {
  it("skips a hole in the array", () => {
    expect(petPhoto(sky)).toBe("sky.jpg");
    expect(petPhoto(bo)).toBe("bo.jpg");
  });

  it("is null when there are none", () => {
    expect(petPhoto({ photos: [] })).toBeNull();
    expect(petPhoto({})).toBeNull();
    expect(petPhoto(null)).toBeNull();
  });
});

describe("bylines", () => {
  it("names the owner as an accompaniment, not a headline", () => {
    expect(broughtBy({ username: "alex" })).toBe("with alex");
    expect(broughtBy({})).toBeNull();
  });

  it("names the owner by their pet for safety flows", () => {
    // You do not block a dog, and this is the phrasing Discover and the chat
    // header already used.
    expect(ownerOf(sky)).toBe("Sky's owner");
    expect(ownerOf(null)).toBe("this person");
  });
});
