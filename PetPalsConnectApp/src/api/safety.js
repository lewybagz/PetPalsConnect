import api from "./axios";

/**
 * Blocking and reporting, from the app's side.
 *
 * Both were inline in three screens, and all three sent PascalCase keys
 * (`{ BlockedUser, Owner }`, `{ Content, ReportedUser, Reporter, Status }`) to
 * lowercase schemas. Strict mode dropped every key, so the saves failed on the
 * required fields that looked present in the source. Two of the three also sent
 * the owner or reporter from the client, which the server no longer accepts -
 * identity comes from the token.
 *
 * One module, so the next screen that needs a block does not invent a fourth
 * payload shape.
 */

/**
 * Why someone is being reported.
 *
 * These strings are the server's enum in `services/reportStates.js`; the labels
 * are what a person reads. Free text alone cannot be triaged - "unsafe" and
 * "spam" cannot wait in the same queue.
 */
export const REPORT_REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "unsafe", label: "Unsafe behaviour towards an animal or person" },
  { value: "fake", label: "Fake profile or impersonation" },
  { value: "spam", label: "Spam or a scam" },
  { value: "other", label: "Something else" },
];

/** Blocks someone. Safe to call twice - the server keeps one row per pair. */
export const blockUser = async (userId) => {
  const { data } = await api.post("/api/blocklists", { blockedUser: userId });
  return data;
};

/** Undoes a block, addressed by the blocked person rather than the row. */
export const unblockUser = async (userId) => {
  const { data } = await api.delete(`/api/blocklists/user/${userId}`);
  return data;
};

/** Everyone the signed-in person has blocked, newest first. */
export const fetchBlocked = async () => {
  const { data } = await api.get("/api/blocklists");
  return Array.isArray(data) ? data : [];
};

/**
 * Files a report. The server blocks the reported person as part of this, so
 * callers do not need a second request - and cannot end up with a report filed
 * and the block missing.
 *
 * Resolves with `{ report, blocked, suspended }`.
 */
export const reportUser = async ({
  userId,
  reason = "other",
  content,
  contentType = "user",
  reportedContent,
}) => {
  const { data } = await api.post("/api/reports", {
    reportedUser: userId,
    reason,
    content,
    reportedContentType: contentType,
    reportedContent,
  });
  return data;
};

/** The reports the signed-in person has filed. */
export const fetchMyReports = async () => {
  const { data } = await api.get("/api/reports");
  return Array.isArray(data) ? data : [];
};
