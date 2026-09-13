import api from "./axios";
import { removeWeight } from "./weight";
import { removeHealthRecord } from "./health";
import { saveSettings } from "./settings";

/**
 * Spot, from the app's side.
 *
 * Every call is the caller's own: the server scopes conversations by owner
 * and binds Spot's tools to the signed-in account, so nothing here carries an
 * identity. What this module owns is the shape of an error the screen has to
 * treat differently (consent, quota, off) and the one table that says how to
 * undo something Spot did.
 */

/** Minutes east of UTC, the way quiet hours already send it. */
export const utcOffsetMinutes = () => -new Date().getTimezoneOffset();

/** Codes the screen branches on. Anything else is "try again". */
export const SPOT_ERRORS = {
  disabled: "SPOT_DISABLED",
  consent: "SPOT_CONSENT_REQUIRED",
  quota: "SPOT_QUOTA",
  failed: "SPOT_FAILED",
};

/** Attaches the server's code and body to the thrown error, so callers can branch. */
const rethrow = (error) => {
  const body = error?.response?.data;
  if (body?.code) {
    error.code = body.code;
    error.body = body;
  }
  throw error;
};

export const fetchSpotStatus = async () => {
  const { data } = await api.get("/api/spot/status", {
    params: { utcOffsetMinutes: utcOffsetMinutes() },
  });
  return {
    enabled: Boolean(data?.enabled),
    consented: Boolean(data?.consented),
    readChats: Boolean(data?.readChats),
    quota: data?.quota ?? null,
  };
};

export const giveSpotConsent = async () => {
  const { data } = await api.post("/api/spot/consent").catch(rethrow);
  return Boolean(data?.consented);
};

export const listConversations = async () => {
  const { data } = await api.get("/api/spot/conversations").catch(rethrow);
  return Array.isArray(data) ? data : [];
};

export const createConversation = async () => {
  const { data } = await api.post("/api/spot/conversations").catch(rethrow);
  return data;
};

export const fetchConversation = async (conversationId) => {
  const { data } = await api.get(`/api/spot/conversations/${conversationId}`).catch(rethrow);
  return { ...data, messages: Array.isArray(data?.messages) ? data.messages : [] };
};

export const deleteConversation = async (conversationId) => {
  const { data } = await api.delete(`/api/spot/conversations/${conversationId}`).catch(rethrow);
  return Boolean(data?.removed);
};

/**
 * One message in, Spot's answer out.
 *
 * `image` is `{ data, mediaType, width, height }` from `compressForSpot`;
 * the bytes travel with this request and are stored nowhere. A 429 with
 * `SPOT_QUOTA` carries `used`, `limit` and `premium` on `error.body`.
 */
export const sendSpotMessage = async (conversationId, { text, image } = {}) => {
  const { data } = await api
    .post(`/api/spot/conversations/${conversationId}/messages`, {
      text: text ?? "",
      image: image ?? undefined,
      utcOffsetMinutes: utcOffsetMinutes(),
    })
    .catch(rethrow);
  return {
    userMessage: data?.userMessage ?? null,
    message: data?.message ?? null,
    quota: data?.quota ?? null,
  };
};

/** "This answer was wrong or harmful." */
export const flagSpotMessage = async (conversationId, messageId, reason) => {
  const { data } = await api
    .post(`/api/spot/conversations/${conversationId}/messages/${messageId}/flag`, {
      reason: reason || undefined,
    })
    .catch(rethrow);
  return Boolean(data?.flagged);
};

/** `{ "units.weight": "lb" }` back into `{ units: { weight: "lb" } }` for `saveSettings`. */
const unflatten = (flat = {}) => {
  const patch = {};
  for (const [path, value] of Object.entries(flat)) {
    const keys = path.split(".");
    let node = patch;
    keys.slice(0, -1).forEach((key) => {
      node[key] = node[key] ?? {};
      node = node[key];
    });
    node[keys[keys.length - 1]] = value;
  }
  return patch;
};

/**
 * How to undo each kind of write Spot can make, by the `undo.kind` on a
 * `done` block. Each one is the ordinary API module the screens already use,
 * so an undo is exactly what tapping delete on that screen would do.
 *
 * `spot.test.js` reads the server's tool file and fails if it can emit an
 * undo kind this table does not know - the two-copies-checked-by-a-test
 * pattern `notificationTypes` uses.
 */
export const UNDO = {
  removeWeight: ({ petId, entryId }) => removeWeight(petId, entryId),
  removeHealthRecord: ({ petId, recordId }) => removeHealthRecord(petId, recordId),
  updateSetting: ({ set }) => saveSettings(unflatten(set)),
};

/** Runs the undo on a `done` block, or throws if the kind is unknown. */
export const undo = async (block) => {
  const handler = UNDO[block?.undo?.kind];
  if (!handler) throw new Error(`Cannot undo ${block?.undo?.kind ?? "that"}`);
  return handler(block.undo);
};
