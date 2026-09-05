import api from "./axios";

/**
 * Account settings, from the app's side.
 *
 * There was no module: the Settings screen posted three named fields to
 * `/api/users/settings` and the Privacy screen posted nothing at all, holding
 * its two toggles in component state with a comment where the save belongs.
 *
 * `GET` returns the settings with every default filled in, plus a `choices`
 * object. The screens build their pickers out of `choices` rather than
 * repeating the option lists, so a value the app can offer is always a value
 * the server's validator accepts - the same reason the notification screen
 * fetches its categories.
 */

/** The caller's settings and the choices each of them allows. */
export const fetchSettings = async () => {
  const { data } = await api.get("/api/users/me/settings");
  return data ?? {};
};

/**
 * Changes some of them.
 *
 * A partial patch: send the setting that moved, nested exactly as it is stored.
 * The server turns that into flat dotted paths, because a `$set` of a whole
 * subdocument would drop every sibling key.
 */
export const saveSettings = async (patch) => {
  const { data } = await api.patch("/api/users/me/settings", patch);
  return data ?? {};
};
