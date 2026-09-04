const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let User;
let Pet;
let Message;
let Notification;
let Friend;
let Report;

/**
 * What one account may see of another.
 *
 * The static audit next door proves the queries are written correctly. These
 * prove the behaviour: a second account really cannot see the first one's
 * rows. The static check would go on passing if someone scoped a query to the
 * wrong field, and this would not.
 */
test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
  Message = require("../models/Message");
  Notification = require("../models/Notification");
  Friend = require("../models/Friend");
  Report = require("../models/Report");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const makeUser = (uid) =>
  User.create({
    firebaseUid: uid,
    username: uid,
    email: `${uid}@example.test`,
    fcmToken: `token-${uid}`,
  });

/** Two strangers: one with data, one who should not see any of it. */
const twoAccounts = async () => {
  const owner = await makeUser("owner");
  const stranger = await makeUser("stranger");
  return { owner, stranger };
};

test("a stranger cannot list your private messages", async () => {
  const { owner, stranger } = await twoAccounts();
  await Message.create({
    sender: owner._id,
    receiver: owner._id,
    creator: owner._id,
    contentText: "meet you at the park",
  });

  const res = await request(app).get("/api/messages").set(...auth("stranger")).expect(200);

  // This endpoint returned every message in the database, both parties
  // populated - the whole app's conversations, to anybody with an account.
  assert.deepEqual(res.body, []);

  const mine = await request(app).get("/api/messages").set(...auth("owner")).expect(200);
  assert.equal(mine.body.length, 1);
  assert.equal(stranger.username, "stranger");
});

test("a stranger cannot list your notifications", async () => {
  const { owner } = await twoAccounts();
  await Notification.create({
    content: "You have a new message",
    recipient: owner._id,
    type: "DirectMessage",
  });

  const res = await request(app)
    .get("/api/notifications")
    .set(...auth("stranger"))
    .expect(200);

  assert.deepEqual(res.body, []);
});

test("a stranger cannot list your friendships", async () => {
  const { owner, stranger } = await twoAccounts();
  const third = await makeUser("third");
  await Friend.create({ user1: owner._id, user2: third._id, creator: owner._id });

  // FriendsListScreen calls this, so unfiltered it showed every friendship in
  // the database as though it were yours.
  const res = await request(app).get("/api/friends").set(...auth("stranger")).expect(200);
  assert.deepEqual(res.body, []);
  assert.ok(stranger);
});

test("a stranger cannot list your reports", async () => {
  const { owner, stranger } = await twoAccounts();
  await Report.create({
    content: "spam",
    reportedContent: "a message",
    status: "pending",
    reportedUser: stranger._id,
    reporter: owner._id,
    creator: owner._id,
  });

  const res = await request(app).get("/api/reports").set(...auth("stranger")).expect(200);
  assert.deepEqual(res.body, []);
});

test("fetching a user by id does not hand over their email or device token", async () => {
  const { owner } = await twoAccounts();

  const res = await request(app)
    .get(`/api/users/${owner._id}`)
    .set(...auth("stranger"))
    .expect(200);

  // The whole document used to come back: email, Firebase uid, FCM token,
  // security questions, Stripe customer id.
  assert.equal(res.body.username, "owner");
  assert.equal(res.body.email, undefined);
  assert.equal(res.body.firebaseUid, undefined);
  assert.equal(res.body.fcmToken, undefined);
});

test("you still get your own full record", async () => {
  const { owner } = await twoAccounts();

  const res = await request(app)
    .get(`/api/users/${owner._id}`)
    .set(...auth("owner"))
    .expect(200);

  assert.equal(res.body.email, "owner@example.test");
});

test("the user list is a username search, not a directory dump", async () => {
  await twoAccounts();
  await makeUser("ownerly");

  const everything = await request(app)
    .get("/api/users")
    .set(...auth("stranger"))
    .expect(200);
  // No query returns nothing rather than every account in the database.
  assert.deepEqual(everything.body, []);

  const search = await request(app)
    .get("/api/users?q=owner")
    .set(...auth("stranger"))
    .expect(200);

  assert.equal(search.body.length, 2);
  assert.equal(search.body[0].email, undefined);
});

test("a stranger cannot read one of your notifications by id", async () => {
  const { owner } = await twoAccounts();
  const notification = await Notification.create({
    content: "private",
    recipient: owner._id,
    type: "DirectMessage",
  });

  // Fetching by id is not authorisation.
  const res = await request(app)
    .get(`/api/notifications/${notification._id}`)
    .set(...auth("stranger"));

  assert.equal(res.status, 404);
});

test("a stranger cannot read one of your messages by id", async () => {
  const { owner } = await twoAccounts();
  const message = await Message.create({
    sender: owner._id,
    receiver: owner._id,
    creator: owner._id,
    contentText: "private",
  });

  const res = await request(app)
    .get(`/api/messages/${message._id}`)
    .set(...auth("stranger"));

  assert.equal(res.status, 404);
});

test("a report records the caller as the reporter, whatever the body says", async () => {
  const { owner, stranger } = await twoAccounts();

  await request(app)
    .post("/api/reports")
    .set(...auth("stranger"))
    .send({
      content: "spam",
      reportedContent: "a message",
      reportedUser: String(owner._id),
      // A body-supplied reporter used to decide whose report this was.
      reporter: String(owner._id),
      creator: String(owner._id),
    });

  const stored = await Report.findOne({}).lean();
  assert.ok(stored, "the report should exist");
  assert.equal(
    String(stored.reporter),
    String(stranger._id),
    "a client could file a report in somebody else's name"
  );
});

test("catalogue reads stay open - the app browses them", async () => {
  const { owner } = await twoAccounts();
  await Pet.create({
    name: "Bo",
    weight: 20,
    breed: "Beagle",
    age: 3,
    owner: owner._id,
    creator: owner._id,
  });

  const pets = await request(app)
    .get("/api/pets/latest")
    .set(...auth("stranger"))
    .expect(200);

  assert.equal(pets.body.length, 1);
  // A pet carries its owner's id, which is why the user projection above
  // matters: the browsable half of the app must not lead to personal data.
  assert.equal(pets.body[0].name, "Bo");
});

/**
 * Matches.
 *
 * `PetMatch` carries two populated pets and says who they are relevant to.
 * Three handlers reached one by id alone - a match id, a user id in the URL,
 * two pet ids - and the static audit passed all three, because a query with a
 * filter on it looks scoped whether or not the filter came from the caller.
 * `requestSuppliedOwners` in the audit is the static half of this; these are
 * the behaviour.
 */
const matchedPair = async () => {
  const { owner, stranger } = await twoAccounts();
  const PetMatch = require("../models/PetMatch");

  const [mine, theirs] = await Promise.all([
    Pet.create({
      name: "Bo",
      weight: 20,
      breed: "Beagle",
      age: 3,
      owner: owner._id,
      creator: owner._id,
    }),
    Pet.create({
      name: "Sky",
      weight: 25,
      breed: "Whippet",
      age: 2,
      owner: stranger._id,
      creator: stranger._id,
    }),
  ]);

  const match = await PetMatch.create({
    pet1: mine._id,
    pet2: theirs._id,
    relevantToUser: owner._id,
    creator: owner._id,
    matchScore: 80,
  });

  return { owner, stranger, mine, theirs, match };
};

test("a stranger cannot read one of your matches by its id", async () => {
  const { match } = await matchedPair();

  await request(app)
    .get(`/api/petmatches/${match._id}`)
    .set(...auth("stranger"))
    .expect(404);
});

test("you can still read your own match by its id", async () => {
  const { match } = await matchedPair();

  const response = await request(app)
    .get(`/api/petmatches/${match._id}`)
    .set(...auth("owner"))
    .expect(200);

  assert.equal(String(response.body._id), String(match._id));
});

test("nobody can list another account's matches by putting its id in the URL", async () => {
  const { owner } = await matchedPair();

  // The route is gone entirely: `GET /` already returns the caller's matches,
  // scoped to the token, so a by-user variant was a second answer to the same
  // question with the filter supplied by whoever was asking.
  await request(app)
    .get(`/api/petmatches/user/${owner._id}`)
    .set(...auth("stranger"))
    .expect(404);
});

test("explaining a match needs one of the pets to be yours", async () => {
  const { mine, theirs } = await matchedPair();
  // A third account, since both pets in the pair belong to the two above and
  // either side is entitled to the explanation.
  await makeUser("outsider");

  await request(app)
    .get(`/api/petmatches/explain/${mine._id}/${theirs._id}`)
    .set(...auth("outsider"))
    .expect(403);

  await request(app)
    .get(`/api/petmatches/explain/${mine._id}/${theirs._id}`)
    .set(...auth("owner"))
    .expect(200);

  // The other owner may ask too - it is their pet in the comparison.
  await request(app)
    .get(`/api/petmatches/explain/${mine._id}/${theirs._id}`)
    .set(...auth("stranger"))
    .expect(200);
});

test("a client cannot put a notification in somebody else's list", async () => {
  const { stranger } = await twoAccounts();

  // `POST /api/notifications` wrote `recipient` from the body. Nothing in the
  // app ever called it, and a notification is a side effect of something
  // happening, not something a client asks for.
  await request(app)
    .post("/api/notifications")
    .set(...auth("stranger"))
    .send({ content: "Click here", recipient: String(stranger._id), type: "message" })
    .expect(404);
});
