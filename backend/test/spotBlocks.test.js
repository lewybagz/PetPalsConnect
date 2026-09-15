const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { SCREENS, link, blocksFrom, stripMarkdown } = require("../services/spot/blocks");
const { EMERGENCY_CONTACTS } = require("../services/petCare/emergency");

/**
 * The rules that attach rich blocks to a Spot answer are mechanical, not
 * prompted, and these are the rules.
 */

test("a toxin lookup always attaches the helpline contacts, once, hit or miss", () => {
  const blocks = blocksFrom([
    { type: "toxin", query: "grapes" },
    { type: "toxin", query: "something not in the table" },
  ]);
  const contacts = blocks.filter((block) => block.type === "contacts");
  assert.equal(contacts.length, 1);
  assert.deepEqual(contacts[0].items, EMERGENCY_CONTACTS);
});

test("no toxin effect, no contacts block", () => {
  assert.deepEqual(blocksFrom([{ type: "link", chip: link("Articles") }]).filter((b) => b.type === "contacts"), []);
});

test("links are gathered into one block and deduped", () => {
  const blocks = blocksFrom([
    { type: "link", chip: link("PetHealth", "abc") },
    { type: "link", chip: link("PetHealth", "abc") },
    { type: "link", chip: link("PetWeight", "abc") },
  ]);
  const links = blocks.filter((block) => block.type === "links");
  assert.equal(links.length, 1);
  assert.deepEqual(
    links[0].items.map((chip) => chip.screen),
    ["PetHealth", "PetWeight"]
  );
  assert.deepEqual(links[0].items[0].params, { petId: "abc" });
});

test("a screen that takes a param is not offered without one", () => {
  assert.equal(link("PetHealth"), null);
  assert.equal(link("NotAScreen", "x"), null);
  assert.deepEqual(link("Articles").params, {});
});

test("each write is its own done block, in order, with its undo", () => {
  const blocks = blocksFrom([
    { type: "done", kind: "logWeight", summary: "Logged Bo at 42 lb", undo: { kind: "removeWeight", petId: "p", entryId: "e" } },
    { type: "done", kind: "removeWeight", summary: "Removed" },
  ]);
  const done = blocks.filter((block) => block.type === "done");
  assert.equal(done.length, 2);
  assert.equal(done[0].kind, "logWeight");
  assert.equal(done[0].undo.kind, "removeWeight");
  assert.equal(done[1].undo, null);
});

test("every screen Spot may open is one AppStack registers", () => {
  const appStack = fs.readFileSync(
    path.resolve(__dirname, "../../PetPalsConnectApp/src/screens/navigation/AppStack.js"),
    "utf8"
  );
  const registered = new Set([...appStack.matchAll(/name="(\w+)"/g)].map((m) => m[1]));
  const missing = Object.keys(SCREENS).filter((screen) => !registered.has(screen));
  assert.deepEqual(missing, [], `SCREENS names routes AppStack does not register: ${missing.join(", ")}`);
});

test("markdown is stripped to plain paragraphs, because nothing renders it", () => {
  const input = [
    "## Heading",
    "",
    "Some **bold** and *italic* and `code` and [a link](https://x.test).",
    "",
    "- first",
    "- second",
    "1. third",
    "> quoted",
  ].join("\n");
  const out = stripMarkdown(input);
  assert.equal(out.includes("**"), false);
  assert.equal(out.includes("##"), false);
  assert.equal(out.includes("- "), false);
  assert.equal(out.includes("]("), false);
  assert.equal(out.includes("`"), false);
  assert.ok(out.startsWith("Heading"));
  assert.ok(out.includes("Some bold and italic and code and a link."));
  assert.ok(out.includes("first\nsecond\nthird\nquoted"));
});

test("stripping leaves ordinary prose alone", () => {
  const prose = "Bella's rabies is current until March 2027.\n\nDHPP has no date on record - your vet can confirm the schedule.";
  assert.equal(stripMarkdown(prose), prose);
});

test("every undo kind the server can emit has a handler in the app", () => {
  /**
   * The app's `UNDO` table in `src/api/spot.js` is the other copy of this.
   * A `done` block whose undo the app cannot run is a button that does
   * nothing, which is the reachability failure this repo keeps finding.
   */
  const tools = fs.readFileSync(path.resolve(__dirname, "../services/spot/tools.js"), "utf8");
  const emitted = new Set([...tools.matchAll(/undo:\s*\{\s*kind:\s*"(\w+)"/g)].map((m) => m[1]));
  assert.ok(emitted.size > 0);

  const app = fs.readFileSync(
    path.resolve(__dirname, "../../PetPalsConnectApp/src/api/spot.js"),
    "utf8"
  );
  const table = app.match(/export const UNDO = \{([\s\S]*?)\n\};/);
  assert.ok(table, "no UNDO table in the app's spot.js");
  const handled = new Set([...table[1].matchAll(/^\s*(\w+):/gm)].map((m) => m[1]));

  const missing = [...emitted].filter((kind) => !handled.has(kind));
  assert.deepEqual(missing, [], `the app cannot undo: ${missing.join(", ")}`);
});

test("a prefilled screen carries only the extra params its entry allows", () => {
  const chip = link("SchedulePlaydate", "their-pet", "Review and send", {
    myPetId: "mine",
    presetDate: "2026-10-03",
    presetTime: "",
    notes: null,
    creator: "somebody-else",
  });
  assert.deepEqual(chip.params, { petId: "their-pet", myPetId: "mine", presetDate: "2026-10-03" });
  // A screen with no `extra` list drops everything but its own param.
  assert.deepEqual(link("PetHealth", "p1", null, { presetDate: "2026-10-03" }).params, { petId: "p1" });
});

test("web links are one block, deduped by url and capped", () => {
  const effects = Array.from({ length: 12 }, (_, i) => ({
    type: "web",
    item: { label: `Pick ${i % 10}`, url: `https://example.test/${i % 10}` },
  }));
  const blocks = blocksFrom(effects);
  const web = blocks.filter((block) => block.type === "web");
  assert.equal(web.length, 1);
  assert.equal(web[0].items.length, 8);
  assert.equal(new Set(web[0].items.map((item) => item.url)).size, 8);
  assert.deepEqual(blocksFrom([{ type: "web", item: { label: "no url" } }]), []);
});

test("cards are one block, deduped by chip, capped at six, and the plain chip for the same screen is dropped", () => {
  const card = (n) => ({
    type: "card",
    item: { title: `Article ${n}`, subtitle: "s", image: null, chip: link("ArticleDetail", `a${n}`, "Read") },
  });
  const effects = [
    { type: "link", chip: link("ArticleDetail", "a1", "Read article") },
    { type: "link", chip: link("Articles") },
    ...Array.from({ length: 8 }, (_, i) => card(i + 1)),
    card(1),
  ];
  const blocks = blocksFrom(effects);
  const cards = blocks.find((block) => block.type === "cards");
  assert.equal(cards.items.length, 6);
  assert.deepEqual(
    cards.items.map((item) => item.title),
    ["Article 1", "Article 2", "Article 3", "Article 4", "Article 5", "Article 6"]
  );
  assert.equal(cards.items[0].chip.screen, "ArticleDetail");
  const links = blocks.find((block) => block.type === "links");
  assert.deepEqual(links.items.map((chip) => chip.screen), ["Articles"], "the card carries the tap; the chip goes");
  assert.ok(blocks.findIndex((b) => b.type === "cards") < blocks.findIndex((b) => b.type === "links"));
  // A card with no chip or no title is not a card.
  assert.deepEqual(blocksFrom([{ type: "card", item: { title: "x" } }]), []);
  assert.deepEqual(blocksFrom([{ type: "card", item: { chip: link("Articles") } }]), []);
});

test("your own vet is a titled contacts block, and never merges into the helpline's", () => {
  const blocks = blocksFrom([
    { type: "toxin", query: "grapes" },
    { type: "contact", item: { id: "loc-1", name: "Sunny Vets", phone: "602", note: "saved place" } },
    { type: "contact", item: { id: "loc-1", name: "Sunny Vets", phone: "602", note: "saved place" } },
    { type: "contact", item: { id: "loc-2", name: "No phone" } },
  ]);
  const contacts = blocks.filter((block) => block.type === "contacts");
  assert.equal(contacts.length, 2);
  const own = contacts.find((block) => block.title);
  assert.equal(own.title, "Your saved places");
  assert.deepEqual(own.items.map((item) => item.id), ["loc-1"]);
  const helpline = contacts.find((block) => !block.title);
  assert.deepEqual(helpline.items, EMERGENCY_CONTACTS);
});
