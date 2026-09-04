/**
 * The vocabulary of a report.
 *
 * A file of its own, with no imports, because both the `Report` schema and the
 * moderation service need it and the moderation service needs the schema - so
 * defining it in either one makes a cycle.
 */

/** Why something was reported. Free text says what happened; this says how urgent. */
const REPORT_REASONS = [
  "harassment",
  "inappropriate",
  "spam",
  "fake",
  "unsafe",
  "other",
];

/** What `reportedContent` names. */
const REPORT_TARGETS = ["user", "pet", "message", "playdate"];

/**
 * pending -> reviewing -> actioned | dismissed.
 *
 * `status` used to be a required String with an empty enum and no default, so
 * every caller invented a value: the app sent "Pending", the controller wrote
 * "pending", and no query could find both. A queue you cannot enumerate is not
 * a queue.
 */
const REPORT_STATUSES = ["pending", "reviewing", "actioned", "dismissed"];

/** Terminal states are terminal: a decision is not quietly reopened. */
const REPORT_TRANSITIONS = {
  pending: ["reviewing", "actioned", "dismissed"],
  reviewing: ["actioned", "dismissed"],
  actioned: [],
  dismissed: [],
};

const canTransition = (from, to) =>
  Boolean(REPORT_TRANSITIONS[from]?.includes(to));

module.exports = {
  REPORT_REASONS,
  REPORT_TARGETS,
  REPORT_STATUSES,
  REPORT_TRANSITIONS,
  canTransition,
};
