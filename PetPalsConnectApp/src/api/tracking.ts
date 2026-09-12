import api from "./axios";
import type {
  Pet,
  ShareParty,
  TrackedCollar,
  TrackedDevice,
  TrackedPosition,
  TrackingShare,
} from "../types/api";

/**
 * The tracking collar, from the app's side.
 *
 * Positions here are exact - that is what a collar is for - and the server
 * decides who may read one (`services/tracking/visibility.js`): the owner,
 * or a friend with a live share. A 404 from any read means "not yours to
 * see" as much as "no such pet", and the screens treat both as the same
 * quiet empty state.
 *
 * Every position carries `recordedAt`, and every screen says how old it is.
 * A stale position presented as live is the failure that matters most here.
 */

export interface TrackingStatus {
  enabled: boolean;
  vendor: string | null;
  /** True when devices POST to the server and a claim hands out a secret. */
  acceptsIngest: boolean;
}

export interface PetPositions {
  pet: Pick<Pet, "_id" | "name" | "photos">;
  owner: ShareParty;
  device: TrackedDevice;
  latest: TrackedPosition | null;
  trail: TrackedPosition[];
  serverTime: string;
}

export interface ClaimResult {
  device: TrackedDevice;
  /** Shown once and never again. Null for a vendor that does not ingest. */
  secret: string | null;
}

export interface Shares {
  given: TrackingShare[];
  received: TrackingShare[];
}

/** How long a share can be, as the screen offers it. Server caps at a week. */
export const SHARE_DURATIONS = [
  { label: "1 hour", value: 1 },
  { label: "4 hours", value: 4 },
  { label: "1 day", value: 24 },
  { label: "1 week", value: 168 },
];

const notFound = (error: unknown): boolean => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 404;
};

const unavailable = (error: unknown): boolean => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 503;
};

/** Whether this server tracks anything at all. Off reads as disabled, not as an error. */
export const fetchTrackingStatus = async (): Promise<TrackingStatus> => {
  try {
    const { data } = await api.get("/api/tracking/status");
    return {
      enabled: Boolean(data?.enabled),
      vendor: data?.vendor ?? null,
      acceptsIngest: Boolean(data?.acceptsIngest),
    };
  } catch (error) {
    if (unavailable(error)) return { enabled: false, vendor: null, acceptsIngest: false };
    throw error;
  }
};

/** The caller's collars, each with where it last was. */
export const fetchDevices = async (): Promise<TrackedDevice[]> => {
  const { data } = await api.get("/api/tracking/devices");
  return Array.isArray(data) ? data : [];
};

/** Registers a collar by serial for one of the caller's pets. */
export const claimDevice = async (serial: string, petId: string): Promise<ClaimResult> => {
  const { data } = await api.post("/api/tracking/devices", { serial, petId });
  return { device: data.device, secret: data.secret ?? null };
};

/** Moves a collar to another of the caller's pets, or retires it. */
export const updateDevice = async (
  deviceId: string,
  patch: { petId?: string; status?: "active" | "inactive" }
): Promise<TrackedDevice> => {
  const { data } = await api.patch(`/api/tracking/devices/${deviceId}`, patch);
  return data;
};

/** Removes a collar and everything it ever reported. */
export const removeDevice = async (deviceId: string): Promise<void> => {
  await api.delete(`/api/tracking/devices/${deviceId}`);
};

/**
 * Where a pet's collar is and has recently been, or null when the caller may
 * not see it - which is also the answer for a pet with no collar.
 */
export const fetchPetPositions = async (petId: string): Promise<PetPositions | null> => {
  try {
    const { data } = await api.get(`/api/tracking/pets/${petId}/positions`);
    return data;
  } catch (error) {
    if (notFound(error)) return null;
    throw error;
  }
};

/** Every collar the caller may see right now, for the map. Off -> empty. */
export const fetchTrackedCollars = async (): Promise<TrackedCollar[]> => {
  try {
    const { data } = await api.get("/api/tracking/map");
    return Array.isArray(data?.collars) ? data.collars : [];
  } catch (error) {
    if (unavailable(error)) return [];
    throw error;
  }
};

/** The shares the caller has given and received, live ones only. */
export const fetchShares = async (): Promise<Shares> => {
  const { data } = await api.get("/api/tracking/shares");
  return {
    given: Array.isArray(data?.given) ? data.given : [],
    received: Array.isArray(data?.received) ? data.received : [],
  };
};

/** Lets a friend see this pet's collar for `hours`. Sharing again extends. */
export const sharePet = async (petId: string, viewerId: string, hours: number): Promise<TrackingShare> => {
  const { data } = await api.post(`/api/tracking/pets/${petId}/shares`, { viewer: viewerId, hours });
  return data;
};

/** Ends a share. */
export const unsharePet = async (petId: string, viewerId: string): Promise<void> => {
  await api.delete(`/api/tracking/pets/${petId}/shares/${viewerId}`);
};

/**
 * "Just now", "4 minutes ago", "2 hours ago", "3 days ago".
 *
 * Stated on every view of a position, because a collar that stopped
 * reporting yesterday looks exactly like one reporting now unless the screen
 * says so.
 */
export const describeLastSeen = (recordedAt?: string | null, now: number = Date.now()): string => {
  if (!recordedAt) return "No position yet";
  const then = new Date(recordedAt).getTime();
  if (Number.isNaN(then)) return "No position yet";
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

/** A position older than this is shown as stale, not live. */
export const STALE_AFTER_MS = 10 * 60 * 1000;

export const isStale = (recordedAt?: string | null, now: number = Date.now()): boolean => {
  if (!recordedAt) return true;
  const then = new Date(recordedAt).getTime();
  return Number.isNaN(then) || now - then > STALE_AFTER_MS;
};

/** "Until 4:30 PM" or "Until Thu 4:30 PM", from a share's expiry. */
export const describeUntil = (expiresAt: string, now: number = Date.now()): string => {
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "";
  const sameDay = new Date(now).toDateString() === date.toDateString();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Until ${time}`;
  const day = date.toLocaleDateString(undefined, { weekday: "short" });
  return `Until ${day} ${time}`;
};
