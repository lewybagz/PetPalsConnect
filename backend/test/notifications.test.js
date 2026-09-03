const test = require("node:test");
const assert = require("node:assert/strict");

const harness = require("./helpers/harness");

let User;
let Notification;
let createNotification;
let fetchGroupParticipants;
let realtime;

/**
 * The notification pipeline.
 *
 * `createNotification` wrote `Content`/`Recipient`/`Type`/`Creator` against a
 * schema whose paths are lowercase. Mongoose strict mode drops unknown keys
 * without complaining, so every notification ever written was an empty
 * document, and `getUserNotifications` - which filters by recipient - could
 * never match one. The write "succeeded" every time.
 *
 * Nothing in the old suite would have caught that: the function returned
 * undefined and threw nothing. These tests read the stored document back.
 */
test.before(async () => {
  await harness.start();
  User = require("../models/User");
  Notification = require("../models/Notification");
  ({ createNotification, fetchGroupParticipants } = require("../services/NotificationService"));
  realtime = require("../services/realtime");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
  realtime.setIO(null);
});

const makeUser = (uid) =>
  User.create({ firebaseUid: uid, username: uid, email: `${uid}@example.test` });

test("a notification is stored with fields that can be read back", async () => {
  const recipient = await makeUser("notif-recipient");
  const creator = await makeUser("notif-creator");

  await createNotification({
    content: "You have a new message from Ada.",
    recipientId: recipient._id,
    type: "DirectMessage",
    creatorId: creator._id,
  });

  const stored = await Notification.findOne({ recipient: recipient._id }).lean();

  assert.ok(stored, "the notification must be findable by its recipient");
  assert.equal(stored.content, "You have a new message from Ada.");
  assert.equal(stored.type, "DirectMessage");
  assert.equal(String(stored.creator), String(creator._id));
});

test("a notification without content or a recipient is refused, not written blank", async () => {
  const recipient = await makeUser("notif-partial");

  await assert.rejects(() => createNotification({ recipientId: recipient._id }));
  await assert.rejects(() => createNotification({ content: "orphan" }));

  assert.equal(await Notification.countDocuments({}), 0);
});

test("the recipient is pushed the notification if they are connected", async () => {
  const recipient = await makeUser("notif-live");
  const emitted = [];

  // Stands in for socket.io: `.to(room).emit(event, payload)`.
  realtime.setIO({
    to: (room) => ({
      emit: (event, payload) => emitted.push({ room, event, payload }),
    }),
  });

  await createNotification({
    content: "Playdate confirmed",
    recipientId: recipient._id,
    type: "Playdate",
  });

  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].room, String(recipient._id));
  assert.equal(emitted[0].event, "notification");
  assert.equal(emitted[0].payload.content, "Playdate confirmed");
});

test("creating a notification still succeeds with no socket server", async () => {
  const recipient = await makeUser("notif-offline");

  // Nobody connected must never fail the write that caused the notification.
  await createNotification({
    content: "Written while nobody is listening",
    recipientId: recipient._id,
    type: "DirectMessage",
  });

  assert.equal(await Notification.countDocuments({ recipient: recipient._id }), 1);
});

test("group participants excludes the sender", async () => {
  const GroupChat = require("../models/GroupChat");
  const sender = await makeUser("group-sender");
  const other = await makeUser("group-other");

  const group = await GroupChat.create({
    groupName: "Park regulars",
    participants: [sender._id, other._id],
    creator: sender._id,
  });

  // This threw "Cannot access 'groupChat' before initialization" on every call,
  // so group message notifications always failed.
  const participants = await fetchGroupParticipants(group._id, sender._id);

  assert.equal(participants.length, 1);
  assert.equal(String(participants[0]._id), String(other._id));
});

test("an unknown group is an error, not a crash on undefined", async () => {
  const mongoose = require("mongoose");
  await assert.rejects(
    () => fetchGroupParticipants(new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()),
    /Group not found/
  );
});
