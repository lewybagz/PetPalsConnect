import api from "./axios";

/**
 * Scheduling and answering playdates.
 *
 * Everything here used to be inline in the screens, in the wrong shape. The
 * create payload was PascalCase (`Date`, `Location`, `Creator`), which Mongoose
 * drops in strict mode, and it never sent `startTime` - required by the schema.
 * Between them, a playdate could never be created at all.
 */

/**
 * Places near a point, within `range` miles.
 * Mounted on /api/locations, not /api/playdates.
 */
export const fetchNearbyLocations = async ({ latitude, longitude, range }) => {
  const { data } = await api.get("/api/locations/playdate-locations", {
    params:
      latitude != null && longitude != null
        ? { userLat: latitude, userLng: longitude, range }
        : undefined,
  });
  return Array.isArray(data) ? data : [];
};

/**
 * Combines a date from one picker with a time from another.
 *
 * The form has both, and only the date was ever sent - so a playdate arranged
 * for 4pm was stored at whatever time the date picker happened to carry.
 */
export const combineDateAndTime = (date, time) => {
  const combined = new Date(date);
  combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return combined;
};

/**
 * Schedules a playdate. The server derives the organiser from the token and
 * the other participants from the owners of the pets involved, so neither is
 * sent from here.
 */
export const createPlaydate = async ({ date, time, locationId, petIds, notes }) => {
  const startTime = time ? combineDateAndTime(date, time) : date;

  const { data } = await api.post("/api/playdates", {
    date: startTime.toISOString(),
    startTime: startTime.toISOString(),
    location: locationId,
    petsInvolved: petIds,
    notes,
  });
  return data;
};

/** The caller's playdates, whatever their state. */
export const fetchMyPlaydates = async () => {
  const { data } = await api.get("/api/playdates/user");
  return Array.isArray(data) ? data : [];
};

/** Accepted playdates still to come. */
export const fetchUpcomingPlaydates = async () => {
  const { data } = await api.get("/api/playdates/upcoming");
  return Array.isArray(data) ? data : [];
};

export const acceptPlaydate = async (playdateId) => {
  const { data } = await api.post(`/api/playdates/accept/${playdateId}`);
  return data;
};

export const declinePlaydate = async (playdateId) => {
  const { data } = await api.post(`/api/playdates/decline/${playdateId}`);
  return data;
};

export const cancelPlaydate = async (playdateId, message) => {
  const { data } = await api.patch(`/api/playdates/${playdateId}/cancel`, { message });
  return data;
};

/** Wording for a playdate's state, so screens do not each invent their own. */
export const describePlaydateStatus = (status) =>
  ({
    pending: "Waiting for a reply",
    accepted: "Confirmed",
    declined: "Declined",
    cancelled: "Cancelled",
    completed: "Done",
  })[status] ?? status;
