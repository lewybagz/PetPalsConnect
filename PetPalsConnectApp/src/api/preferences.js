import api from "./axios";

/**
 * Notification preferences, from the app's side.
 *
 * There was no module and no call: `NotificationPreferencesScreen` held two
 * toggles in component state with `// Update push notification settings in
 * user preferences` where the save belongs, so turning notifications off did
 * nothing and looked like it had worked. The one place that did call the API -
 * a "Mute Notifications" item in the notification row's kebab menu - patched
 * all five preferences to false from a per-row menu, which is a global mute
 * reachable by mis-tapping a row.
 */

/**
 * The categories a switch can govern.
 *
 * Fetched rather than hard-coded, so a category added on the server appears
 * here instead of being silently unreachable - the server's own test checks
 * every one of them names a real preference.
 */
export const fetchCategories = async () => {
  const { data } = await api.get("/api/userpreferences/categories");
  return Array.isArray(data?.categories) ? data.categories : [];
};

/** What quiet hours look like before anybody has set them. */
export const DEFAULT_QUIET_HOURS = {
  enabled: false,
  start: "22:00",
  end: "07:00",
  utcOffsetMinutes: 0,
};

/**
 * The caller's preferences, created from defaults on first read.
 *
 * Returns the switches *and* the quiet-hours window together, because they are
 * one document and one request. Fetching them separately would be two round
 * trips to the same row and two chances for the screen to render half of what
 * it knows.
 */
export const fetchPreferences = async () => {
  const { data } = await api.get("/api/userpreferences/me");
  return {
    notificationPreferences: data?.notificationPreferences ?? {},
    quietHours: { ...DEFAULT_QUIET_HOURS, ...(data?.quietHours ?? {}) },
  };
};

/**
 * Saves part of the quiet-hours window.
 *
 * The offset travels with every save rather than only when it changes: the
 * window is wall-clock, and the phone doing the saving is the one that knows
 * where its owner currently is. Somebody who set 22:00 in London and has landed
 * in New York means ten at night, not three in the afternoon.
 *
 * `notify()` consults this through `wantsPush()`, so a quiet window silences
 * the push and still writes the row - the record is the durable part, and
 * somebody who slept through a match should find it in the morning.
 */
export const saveQuietHours = async (changes) => {
  const { data } = await api.patch("/api/userpreferences/me", {
    quietHours: { ...changes, utcOffsetMinutes: -new Date().getTimezoneOffset() },
  });
  return { ...DEFAULT_QUIET_HOURS, ...(data?.quietHours ?? {}) };
};

/**
 * Changes some of them.
 *
 * A merge: send the switch that moved. Sending the whole object would reset
 * anything the screen has not loaded yet.
 */
export const savePreferences = async (changes) => {
  const { data } = await api.patch("/api/userpreferences/me", {
    notificationPreferences: changes,
  });
  return data?.notificationPreferences ?? {};
};
