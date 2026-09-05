/**
 * A one-way channel from the API client to the session.
 *
 * The API can tell us the session has changed underneath us - an account
 * suspended mid-use, a token revoked after a phone was reported stolen - and
 * the only place that learns is an axios interceptor, which is a module with no
 * React in it. Without somewhere to say so, the app carries on rendering its
 * normal tree while every request comes back 403, and the user gets a screenful
 * of toasts that explain nothing.
 *
 * Deliberately tiny: a set of callbacks, no payloads beyond a reason, no
 * queueing. `AuthSessionContext` subscribes and re-reads the profile, which is
 * what actually decides the new state - the interceptor only knows something
 * changed, not what the session should become.
 */

const listeners = new Set();

/** Subscribe. Returns an unsubscribe function. */
export const onSessionInvalidated = (handler) => {
  listeners.add(handler);
  return () => listeners.delete(handler);
};

/**
 * Announce that the server no longer accepts this session as it stands.
 *
 * `reason` is one of "suspended" or "revoked", which the session uses only for
 * logging - what to do about it is decided by re-reading the profile.
 */
export const sessionInvalidated = (reason) => {
  for (const handler of listeners) {
    try {
      handler(reason);
    } catch (error) {
      // A subscriber that throws must not stop the others hearing about it.
      console.warn("[session] listener failed:", error?.message);
    }
  }
};

/** Test seam: drop every subscriber. */
export const resetSessionEvents = () => listeners.clear();
