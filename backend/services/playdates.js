const Playdate = require("../models/Playdate");
const User = require("../models/User");
const { notify } = require("./NotificationService");

/**
 * Answering and cancelling a playdate, in one place.
 *
 * `PlaydateController` did these inline and Spot needed them too, which is the
 * same fork `weights.js` and `healthRecords.js` closed: two writers for one
 * thing is the bug shape this codebase keeps finding. The controller calls
 * these and answers HTTP; Spot calls them and shows a card. Every rule is
 * here once: only an invitee may accept or decline, only once, never the
 * organiser; and - new, because it was missing - only somebody on a playdate
 * may cancel it. The old handler cancelled whatever id it was given.
 *
 * Errors carry `status` so a controller can answer with it and a tool can
 * explain it. The message strings are the ones the app already shows.
 */

const fail = (status, message) => Object.assign(new Error(message), { status });

const same = (a, b) => String(a) === String(b);

const firstPetName = (user) => user?.pets?.[0]?.name || "Unknown Pet";

const populated = (playdateId) =>
  Playdate.findById(playdateId)
    .populate({ path: "participants", select: "username pets", populate: { path: "pets", select: "name" } })
    .populate({ path: "creator", select: "username pets", populate: { path: "pets", select: "name" } })
    .populate("petsInvolved", "name owner")
    .populate("location", "name");

/** Accepts or declines an invitation the caller received. Returns the playdate. */
const respond = async ({ userId, playdateId, decision }) => {
  if (!["accept", "decline"].includes(decision)) throw fail(400, "decision must be accept or decline");

  const playdate = await populated(playdateId);
  if (!playdate) throw fail(404, "Playdate not found");
  if (!playdate.participants.some((participant) => same(participant._id, userId))) {
    throw fail(403, "You were not invited to this");
  }
  if (decision === "accept" && same(playdate.creator._id, userId)) {
    throw fail(400, "You organised this one");
  }
  if (playdate.status !== "pending") {
    throw fail(409, `This playdate is already ${playdate.status}`);
  }

  playdate.status = decision === "accept" ? "accepted" : "declined";
  playdate.modifiedDate = new Date();
  await playdate.save();

  if (decision === "accept") {
    const accepter = await User.findById(userId).populate("pets", "name");
    const mine = firstPetName(accepter);
    await notify({
      content: `Hey ${firstPetName(playdate.creator)}! Your playdate with ${mine} has been confirmed.`,
      recipientId: playdate.creator._id,
      type: "playdateAccepted",
      creatorId: userId,
      petName: mine,
      data: { playdateId },
    });
  } else {
    // Declining silently left the organiser waiting on an answer already given.
    await notify({
      content: "Your playdate request was declined.",
      recipientId: playdate.creator._id,
      type: "playdateDeclined",
      creatorId: userId,
      data: { playdateId: playdate._id },
    });
  }

  return playdate;
};

/** Cancels a playdate the caller is on, and tells everyone else on it. */
const cancel = async ({ userId, playdateId, reason }) => {
  const playdate = await populated(playdateId);
  if (!playdate) throw fail(404, "Playdate not found");
  const onIt =
    same(playdate.creator._id, userId) ||
    playdate.participants.some((participant) => same(participant._id, userId));
  if (!onIt) throw fail(403, "You're not on this playdate");

  playdate.status = "cancelled";
  playdate.cancellationReason = reason || "No specific reason provided";
  playdate.modifiedDate = new Date();
  await playdate.save();

  const cancellerPet = firstPetName(playdate.creator);
  const why = reason || "no reason given";
  const others = [playdate.creator, ...playdate.participants].filter(
    (person, index, all) => !same(person._id, userId) && all.findIndex((p) => same(p._id, person._id)) === index
  );
  await Promise.all(
    others.map((person) =>
      notify({
        content: same(person._id, playdate.creator._id)
          ? `Your playdate involving ${cancellerPet} has been cancelled. Reason: ${why}`
          : `${firstPetName(person)}, a playdate with ${cancellerPet} has been cancelled. Reason: ${why}`,
        recipientId: person._id,
        type: "playdateCancelled",
        creatorId: userId,
        petName: cancellerPet,
        data: { playdateId },
      })
    )
  );

  return playdate;
};

module.exports = { respond, cancel };
