const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const {
  audit,
  findCreateSites,
  requiredPaths,
  loadModels,
} = require("../services/schemaAudit");

/**
 * The guard against "this write can never succeed".
 *
 * Five features of this app were dead because a controller set fields the
 * schema does not have, or missed one it requires. Every one of them failed
 * silently - the write was rejected inside a catch that only logged, or the
 * request returned a 400 nobody was watching:
 *
 *   Notification  wrote Content/Recipient/Type; the paths are lowercase
 *   Favorite      never set `pet`
 *   Playdate      never set `startTime`
 *   ActivityLog   wrote ActionDetails/ActionType/User/Creator
 *   Article       wrote Content/PublishedDate/Tags, and no author or creator
 *   BlockList     wrote BlockedUser/Owner/Creator
 *   Event         wrote Attendees/Date/Description/Organizer/Title/Creator
 *   Friend        wrote Status/User1/User2/Creator
 *   Location      never set `placeId`
 *
 * Nine call sites, one shape of mistake. The first three were found one at a
 * time by using the app; this test found the other six at once.
 */

test("every create path can satisfy its model", () => {
  const problems = audit();

  assert.deepEqual(
    problems,
    [],
    `documents these call sites build can never be saved:\n  ${problems.join("\n  ")}`
  );
});

test("the audit actually reads the call sites, so it cannot pass vacuously", () => {
  const models = loadModels();
  const sites = findCreateSites(models);

  assert.ok(sites.length > 15, `expected to find create sites, found ${sites.length}`);

  // Every site must name a real model and have read some fields, or the parser
  // has quietly stopped understanding the code it is meant to be checking.
  for (const site of sites) {
    assert.ok(models[site.modelName], `${site.file}:${site.line} unknown model`);
    assert.ok(
      site.fields.length > 0,
      `${site.file}:${site.line} parsed no fields for ${site.modelName}`
    );
  }
});

test("it reads shorthand properties, not just explicit keys", () => {
  const models = loadModels();
  const sites = findCreateSites(models);

  // `Notification.create({ content, recipient: recipientId, type, ... })` in
  // NotificationService mixes both forms. A parser that only sees `key:`
  // reports `content` and `type` as missing, and the real findings drown.
  const site = sites.find((candidate) =>
    candidate.file.endsWith("NotificationService.js")
  );

  assert.ok(site, "expected the notification create site");
  assert.ok(site.fields.includes("content"), "shorthand key not read");
  assert.ok(site.fields.includes("recipient"), "explicit key not read");
});

test("a conditional requirement is not treated as an absolute one", () => {
  loadModels();

  // Media's `thumbnail` is `required: () => this.type === "video"`. Whether a
  // call site satisfies that cannot be decided from the source, and reporting
  // it would be a bug that is not there.
  const media = mongoose.model("Media");
  assert.ok(media.schema.path("thumbnail").isRequired);
  assert.ok(!requiredPaths(media).includes("thumbnail"));
});

test("a field a hook derives does not count as missing", () => {
  loadModels();

  // `Pet` is a discriminator of `Content`, which requires `title`; a
  // pre-validate hook on the base derives it from the pet's name. Reading the
  // hooks rather than hardcoding an exception means deleting the hook brings
  // the finding back.
  const pet = mongoose.model("Pet");
  assert.ok(requiredPaths(pet).includes("title"), "title is required by Content");
  assert.deepEqual(audit().filter((problem) => problem.includes("Pet")), []);
});
