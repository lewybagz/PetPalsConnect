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

/** The caller's preferences. Created from defaults on first read. */
export const fetchPreferences = async () => {
  const { data } = await api.get("/api/userpreferences/me");
  return data?.notificationPreferences ?? {};
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
