import api from "./axios";

/**
 * The launch waitlist, from the app's side.
 *
 * The app is open in one region at a time; `LAUNCH_REGIONS` mirrors
 * `backend/services/regions.js` and `backend/test/regions.test.js` checks the
 * two agree. A profile with no region predates the field and is let in.
 */
export const LAUNCH_REGIONS = ["AZ"];

export const isLaunched = (region) => region == null || LAUNCH_REGIONS.includes(region);

/** Joins. Safe to call twice; where you are comes from the profile, not from here. */
export const joinWaitlist = async () => {
  const { data } = await api.post("/api/waitlist");
  return { joined: Boolean(data?.joined), since: data?.since ?? null };
};

/** Whether the caller is already on it, so a reinstall does not ask again. */
export const fetchWaitlistStatus = async () => {
  const { data } = await api.get("/api/waitlist/me");
  return { joined: Boolean(data?.joined), since: data?.since ?? null };
};
