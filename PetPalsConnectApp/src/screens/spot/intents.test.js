import {
  resolveIntent,
  answerConvert,
  answerDue,
  answerFact,
  answerEmergency,
  answerWeight,
  answerToxin,
  answerOpen,
  chipsFor,
} from "./intents";

/**
 * Software first. These are the questions that never reach the model, and
 * the shape of the answer each one gets.
 */

const bella = { _id: "p1", name: "Bella", species: "dog", breed: "Beagle" };
const max = { _id: "p2", name: "Max", species: "cat" };
const one = { pets: [bella], units: { distance: "mi", weight: "lb" } };
const two = { pets: [bella, max], units: { distance: "mi", weight: "lb" } };

describe("resolveIntent", () => {
  test("nothing is nothing", () => {
    expect(resolveIntent("", one)).toBeNull();
    expect(resolveIntent("   ", one)).toBeNull();
  });

  test("emergency numbers, however it is asked", () => {
    expect(resolveIntent("emergency numbers", one)).toEqual({ kind: "emergency" });
    expect(resolveIntent("what's the poison helpline number?", one)).toEqual({ kind: "emergency" });
    expect(resolveIntent("who do I call?", one)).toEqual({ kind: "emergency" });
  });

  test("logging a weight names the pet and converts to pounds", () => {
    expect(resolveIntent("log Bella at 42 lb", one)).toMatchObject({ kind: "weight", pet: bella, pounds: 42 });
    expect(resolveIntent("log her at 42 pounds", one)).toMatchObject({ kind: "weight", pounds: 42 });
    expect(resolveIntent("record Bella's weight 20 kg", one)).toMatchObject({ kind: "weight", pounds: 44.1 });
  });

  test("a bare number takes the owner's unit", () => {
    const metric = { pets: [bella], units: { distance: "km", weight: "kg" } };
    expect(resolveIntent("log Bella at 20", metric)).toMatchObject({ kind: "weight", pounds: 44.1, unit: "kg" });
    expect(resolveIntent("log Bella at 20", one)).toMatchObject({ kind: "weight", pounds: 20, unit: "lb" });
  });

  test("two pets and no name is the model's question to ask", () => {
    expect(resolveIntent("log 42 lb", two)).toBeNull();
    expect(resolveIntent("log Max at 12 lb", two)).toMatchObject({ kind: "weight", pet: max, pounds: 12 });
  });

  test("a nonsense weight is not logged", () => {
    expect(resolveIntent("log Bella at 900 lb", one)).toBeNull();
    expect(resolveIntent("log Bella at 0 lb", one)).toBeNull();
  });

  test("is she due for anything", () => {
    expect(resolveIntent("Is Bella due for anything?", one)).toEqual({ kind: "due", pet: bella });
    expect(resolveIntent("are her shots up to date", one)).toEqual({ kind: "due", pet: bella });
    expect(resolveIntent("is Max due?", two)).toEqual({ kind: "due", pet: max });
    // Two pets, no name: ambiguous.
    expect(resolveIntent("are the vaccinations current?", two)).toBeNull();
    // A statement about vaccines, not a question, is for the model.
    expect(resolveIntent("Bella had her rabies shot yesterday", one)).toBeNull();
  });

  test("open a screen, with the pet where the screen needs one", () => {
    expect(resolveIntent("open settings", one)).toEqual({ kind: "open", screen: "Settings", params: {} });
    expect(resolveIntent("show me my orders", one)).toEqual({ kind: "open", screen: "Orders", params: {} });
    expect(resolveIntent("open Bella's health records", one)).toEqual({
      kind: "open",
      screen: "PetHealth",
      params: { petId: "p1" },
    });
    expect(resolveIntent("open weight", two)).toBeNull();
    expect(resolveIntent("open the moon", one)).toBeNull();
  });

  test("something she ate is a toxin query", () => {
    expect(resolveIntent("Bella ate grapes", one)).toEqual({ kind: "toxin", query: "grapes" });
    expect(resolveIntent("my dog just ate some chocolate", one)).toEqual({ kind: "toxin", query: "chocolate" });
    expect(resolveIntent("is xylitol dangerous for dogs?", one)).toEqual({ kind: "toxin", query: "xylitol" });
    expect(resolveIntent("are lilies toxic", one)).toEqual({ kind: "toxin", query: "lilies" });
  });

  test("a question the app cannot answer goes to the model", () => {
    expect(resolveIntent("why does Bella eat grass?", one)).toBeNull();
    expect(resolveIntent("what should I know about a beagle?", one)).toBeNull();
    expect(resolveIntent("how do I introduce a second cat", two)).toBeNull();
  });
});

describe("answers", () => {
  test("due: the owner's own status, in words, with the records one tap away", () => {
    const answer = answerDue(bella, "partial");
    expect(answer.role).toBe("assistant");
    expect(answer.source).toBe("software");
    expect(answer.text).toMatch(/^Bella: /);
    expect(answer.text).toMatch(/Rabies, DHPP and Bordetella/);
    expect(answer.blocks[0]).toEqual({
      type: "links",
      items: [{ screen: "PetHealth", params: { petId: "p1" }, label: "Health records" }],
    });
  });

  test("emergency: the numbers as a contacts block", () => {
    const contacts = [{ id: "a", name: "A", phone: "1" }];
    expect(answerEmergency(contacts).blocks).toEqual([{ type: "contacts", items: contacts }]);
    expect(answerEmergency([]).blocks).toEqual([]);
    expect(answerEmergency([]).text).toMatch(/vet/);
  });

  test("weight: a done card with the undo, shown in the owner's unit", () => {
    const answer = answerWeight(bella, { _id: "e1", pounds: 44.1 }, { distance: "km", weight: "kg" });
    expect(answer.text).toBe("Logged Bella at 20 kg.");
    const done = answer.blocks.find((b) => b.type === "done");
    expect(done.undo).toEqual({ kind: "removeWeight", petId: "p1", entryId: "e1" });
    expect(answer.blocks.find((b) => b.type === "links").items[0].screen).toBe("PetWeight");
  });

  test("open: one chip", () => {
    expect(answerOpen("Settings", {}, "Settings").blocks[0].items).toEqual([
      { screen: "Settings", params: {}, label: "Settings" },
    ]);
  });

  test("toxin: an exact hit reads like the toxin screen and carries the numbers; a miss is null", () => {
    const toxins = [
      {
        slug: "grapes-raisins",
        name: "Grapes, raisins and currants",
        aliases: ["grape"],
        species: ["dog"],
        severity: "emergency",
        signs: "Vomiting.",
        guidance: "Ring the helpline.",
        sources: [],
      },
    ];
    const contacts = [{ id: "a", name: "A", phone: "1" }];
    const hit = answerToxin("grapes", toxins, contacts);
    expect(hit.text).toMatch(/^Grapes, raisins and currants: Do not wait\./);
    expect(hit.text).toMatch(/not a judgement about your pet/);
    expect(hit.text).not.toMatch(/mg\/kg|how much/i);
    expect(hit.blocks.find((b) => b.type === "contacts").items).toEqual(contacts);
    expect(answerToxin("banana", toxins, contacts)).toBeNull();
  });

  test("the chips are questions this file answers, named for the first pet", () => {
    const chips = chipsFor([bella]);
    expect(chips[0]).toBe("Is Bella due for anything?");
    expect(resolveIntent(chips[0], one)).toEqual({ kind: "due", pet: bella });
    expect(resolveIntent(chips[1], one)).toEqual({ kind: "emergency" });
    expect(chipsFor([])).not.toContain(null);
  });
});

describe("phase 4: facts, arithmetic, more screens, chips that follow the screen", () => {
  const full = { _id: "p1", name: "Bella", species: "dog", breed: "Beagle", weight: 40, age: 4 };
  const ctx = { pets: [full], units: { distance: "mi", weight: "lb" } };

  test("a fact the profile already holds never reaches the model", () => {
    expect(resolveIntent("how much does Bella weigh?", ctx)).toEqual({ kind: "fact", pet: full, fact: "weight" });
    expect(resolveIntent("what's Bella's weight", ctx)).toEqual({ kind: "fact", pet: full, fact: "weight" });
    expect(resolveIntent("how old is Bella?", ctx)).toEqual({ kind: "fact", pet: full, fact: "age" });
    // A profile with no weight has nothing to say; the model can ask.
    expect(resolveIntent("how much does Bella weigh?", one)).toBeNull();
    // Two pets, no name: ambiguous.
    expect(resolveIntent("how old is she?", { ...two, pets: [full, { ...max, age: 2 }] })).toBeNull();
  });

  test("a conversion is arithmetic, and only between units of the same kind", () => {
    expect(resolveIntent("12 kg in pounds", one)).toEqual({ kind: "convert", value: 12, from: "kg", to: "lb" });
    expect(resolveIntent("what is 5 miles in km?", one)).toEqual({ kind: "convert", value: 5, from: "mi", to: "km" });
    expect(resolveIntent("convert 20 lb to kilograms", one)).toEqual({ kind: "convert", value: 20, from: "lb", to: "kg" });
    expect(resolveIntent("12 kg in miles", one)).toBeNull();
    expect(resolveIntent("12 kg in kg", one)).toBeNull();
  });

  test("bare 'my orders' opens the screen; 'my dog ate' is still a toxin question", () => {
    expect(resolveIntent("my orders", one)).toEqual({ kind: "open", screen: "Orders", params: {} });
    expect(resolveIntent("my pals", one)).toEqual({ kind: "open", screen: "FriendsList", params: {} });
    expect(resolveIntent("show me my saved places", one)).toEqual({ kind: "open", screen: "Favorites", params: {} });
    expect(resolveIntent("my dog just ate some chocolate", one)).toEqual({ kind: "toxin", query: "chocolate" });
    expect(resolveIntent("my vet is great", one)).toBeNull();
  });

  test("the answers, in the owner's units", () => {
    const metric = { distance: "km", weight: "kg" };
    expect(answerFact(full, "weight", metric).text).toBe("Bella weighs 18.1 kg, as of the last weigh-in.");
    expect(answerFact(full, "weight", ctx.units).blocks[0].items[0].screen).toBe("PetWeight");
    expect(answerFact(full, "age").text).toBe("Bella is 4 years old.");
    expect(answerFact({ ...full, age: 1 }, "age").text).toBe("Bella is 1 year old.");
    expect(answerConvert({ value: 12, from: "kg", to: "lb" }).text).toBe("12 kg is 26.5 lb.");
    expect(answerConvert({ value: 5, from: "mi", to: "km" }).text).toBe("5 mi is 8 km.");
    expect(answerConvert({ value: 12, from: "kg", to: "lb" }).source).toBe("software");
  });

  test("chips follow the screen Spot was opened from, and stay four", () => {
    expect(chipsFor([bella], { petId: "p1", screen: "weight" })[0]).toBe("Log a weigh-in for Bella");
    expect(chipsFor([bella], { screen: "toxin" })[0]).toBe("My pet ate something");
    expect(chipsFor([bella], { playdateId: "pd", screen: "playdate" })[0]).toBe("Reply to this playdate");
    // The health chip is already in the default list, so it is not repeated.
    const health = chipsFor([bella], { petId: "p1", screen: "health" });
    expect(health[0]).toBe("Is Bella due for anything?");
    expect(new Set(health).size).toBe(health.length);
    expect(chipsFor([bella, max], { petId: "p2", screen: "tracking" })[0]).toBe("Where was Max last seen?");
    for (const chips of [chipsFor([bella]), chipsFor([]), chipsFor([bella], { screen: "order" })]) {
      expect(chips.length).toBeLessThanOrEqual(4);
      expect(chips).not.toContain(null);
    }
  });
});
