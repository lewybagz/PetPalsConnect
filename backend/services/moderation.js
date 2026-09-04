const Report = require("../models/Report");
const User = require("../models/User");
const blocking = require("./blocking");
const { canTransition } = require("./reportStates");

/**
 * What happens after somebody taps "Report".
 *
 * Nothing did. `createReport` said `const report = new report({...})`, which
 * references the binding being declared on that same line - a TDZ error thrown
 * outside the try below, so filing a report has always been a 500. Not one has
 * ever been written, which means the number of reports this app has acted on
 * is not low, it is undefined.
 *
 * Both stores require more than a button. Apple's guideline 1.2 wants a way to
 * report, a way to block, and evidence that reports are acted on; Google Play's
 * UGC policy says the same. This app has no moderators and no admin console, so
 * the mechanism has to work while nobody is looking - hence the threshold
 * below. A moderator allowlist sits on top of it for the cases a count cannot
 * decide.
 */

/**
 * Distinct reporters before an account is hidden automatically.
 *
 * Three, not one: one report hides anybody who annoys a single determined
 * person, and the schema's unique index means one account cannot supply all
 * three. Three strangers independently reporting the same person is a signal
 * worth acting on before a human gets to it, and suspension is reversible.
 */
const AUTO_SUSPEND_THRESHOLD = 3;

/**
 * Moderators, by email, from the environment.
 *
 * There is no admin role in this database and adding one is a new authorisation
 * surface to get wrong. An allowlist the deployer controls needs no schema, no
 * UI to grant it, and cannot be escalated into from inside the app.
 */
const moderatorEmails = () =>
  String(process.env.MODERATOR_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

const isModerator = (user) => {
  const email = user?.email?.toLowerCase();
  return Boolean(email) && moderatorEmails().includes(email);
};

/** Express guard. Use after `authenticate` on the moderation routes. */
const requireModerator = (req, res, next) => {
  if (!isModerator(req.user)) {
    // 404, not 403: a 403 confirms the route exists and that somebody has the
    // rights, which is a thing worth not telling people.
    return res.status(404).json({ message: "Not found" });
  }
  return next();
};

const suspend = async (userId, reason) => {
  if (!userId) return null;
  return User.findByIdAndUpdate(
    userId,
    { suspended: true, suspendedAt: new Date(), suspendedReason: reason },
    { returnDocument: "after" }
  );
};

/**
 * Counts the distinct people who have reported this account and still stand by
 * it, and hides the account once enough of them do.
 *
 * Dismissed reports do not count - otherwise a resolved complaint keeps
 * pushing somebody towards suspension forever.
 */
const applyAutoSuspension = async (reportedUserId) => {
  if (!reportedUserId) return false;

  const reporters = await Report.distinct("reporter", {
    reportedUser: reportedUserId,
    status: { $ne: "dismissed" },
  });

  if (reporters.length < AUTO_SUSPEND_THRESHOLD) return false;

  const user = await User.findById(reportedUserId).select("suspended").lean();
  if (!user || user.suspended) return false;

  await suspend(
    reportedUserId,
    `Reported by ${reporters.length} people; awaiting review`
  );
  return true;
};

/**
 * Files a report.
 *
 * Reporting someone also blocks them. Offering "report" without removing the
 * person from your deck and your inbox asks somebody who has just told us they
 * feel unsafe to keep looking at the reason - and the block is the only part of
 * this that helps them within the next second.
 */
const fileReport = async ({
  reporterId,
  reportedUserId,
  reportedContent,
  reportedContentType = "user",
  reason = "other",
  content,
}) => {
  if (!reporterId) throw new Error("A report needs a reporter");
  if (!content) throw new Error("A report needs a description");
  if (String(reporterId) === String(reportedUserId)) {
    throw new Error("You cannot report yourself");
  }

  const target = reportedContent ?? `${reportedContentType}:${reportedUserId}`;

  // Filing the same report twice is one report. The unique index makes that
  // true even when two taps race; this turns the duplicate-key error into the
  // existing row rather than a 400 the reporter cannot act on.
  let report;
  try {
    report = await Report.create({
      content,
      reportedContent: target,
      reportedContentType,
      reportedUser: reportedUserId,
      reason,
      reporter: reporterId,
      creator: reporterId,
      status: "pending",
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    report = await Report.findOne({
      reporter: reporterId,
      reportedUser: reportedUserId,
      reportedContent: target,
    });
  }

  let blocked = false;
  if (reportedUserId) {
    await blocking.block({ ownerId: reporterId, blockedUserId: reportedUserId });
    blocked = true;
  }

  const suspended = await applyAutoSuspension(reportedUserId);

  return { report, blocked, suspended };
};

/**
 * Moves a report along. Returns `{ ok: false, message }` on an illegal move
 * rather than throwing, so the route can answer 400 without a try/catch that
 * cannot tell an invalid transition from a database failure.
 */
const transitionReport = async ({ report, to, resolution, moderatorId }) => {
  if (!canTransition(report.status, to)) {
    return {
      ok: false,
      message: `A ${report.status} report cannot become ${to}`,
    };
  }

  report.status = to;
  report.resolution = resolution;
  report.modifiedDate = new Date();
  if (to === "actioned" || to === "dismissed") {
    report.resolvedAt = new Date();
    report.resolvedBy = moderatorId;
  }
  await report.save();

  if (to === "actioned" && report.reportedUser) {
    await suspend(report.reportedUser, resolution ?? "Actioned after review");
  }

  return { ok: true, report };
};

module.exports = {
  AUTO_SUSPEND_THRESHOLD,
  isModerator,
  requireModerator,
  suspend,
  applyAutoSuspension,
  fileReport,
  transitionReport,
};
