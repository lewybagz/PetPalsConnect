import { AppState, Platform } from "react-native";
import Constants from "expo-constants";

import api from "../api/axios";
import { readCache, writeCache, removeCache } from "./localCache";

/**
 * Product analytics, buffered.
 *
 * The app had no measurement of any kind, so every retention number the
 * roadmap was argued from belonged to somebody else's app in somebody else's
 * category - and there is no credible public data on pet social app retention
 * at all. This is how we get ours.
 *
 * Two rules, and both are the same rule as `notify()`'s push half on the
 * server: **this must never be the reason something else breaks.** Every
 * function here swallows its own errors, nothing awaits a network call on a UI
 * path, and a dropped event is always the right trade against a broken screen.
 * An analytics call that can throw is a analytics call that will eventually
 * take a signup down with it.
 *
 * Buffered rather than sent per event because the interesting part of the
 * funnel is somebody's first ninety seconds, which is exactly when the network
 * is least likely to be warm. Events carry their own `at`, so a batch that
 * flushes twenty minutes later still reports what happened when it happened.
 *
 * Deliberately not a vendor SDK. `CLAUDE.md` has MongoDB as the single source
 * of truth for app data and Firebase as auth, push and storage only - a funnel
 * we make product decisions from is app data. No device identifier is
 * collected here, which is what keeps this first-party product analytics
 * rather than tracking.
 */

/** The names the server's table will accept. Anything else is dropped there. */
export type EventName =
  | "app_opened"
  | "signup_started"
  | "account_created"
  | "profile_started"
  | "profile_created"
  | "pet_started"
  | "pet_created"
  | "pet_skipped"
  | "onboarding_completed"
  | "first_swipe"
  | "first_match"
  | "push_primer_shown"
  | "push_permission_result"
  | "deck_emptied";

/** Small and scalar; the server drops anything else. */
type Props = Record<string, string | number | boolean>;

type BufferedEvent = {
  name: EventName;
  props?: Props;
  at: string;
};

const BUFFER_KEY = "analytics-buffer";

/** One flush is a screen's worth, matching the server's batch cap. */
const MAX_BATCH = 50;

/**
 * Above this the oldest go. A buffer that grows without limit on a device that
 * is offline for a week is a storage leak, and the events that matter most are
 * the recent ones.
 */
const MAX_BUFFER = 200;

const FLUSH_INTERVAL_MS = 30_000;

let buffer: BufferedEvent[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let flushing = false;
let started = false;

const appVersion =
  (Constants.expoConfig?.version as string | undefined) ?? undefined;

const platform = Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web";

/**
 * Records something that happened.
 *
 * Returns nothing and is safe to call without `await`. Callers should not
 * await it: the whole point is that nothing on a UI path waits for analytics.
 */
export const track = (name: EventName, props?: Props): void => {
  try {
    buffer.push({ name, props, at: new Date().toISOString() });
    if (buffer.length > MAX_BUFFER) buffer = buffer.slice(-MAX_BUFFER);
    void persist();
  } catch {
    // Never throws. There is nothing a caller could do about it and nothing
    // worth failing a screen over.
  }
};

/**
 * Mirrors the buffer to storage so a kill between flushes does not lose it.
 *
 * The first ninety seconds are the most interesting and the most likely to end
 * in a force-quit, which is precisely the window an in-memory-only buffer
 * would throw away.
 */
const persist = async (): Promise<void> => {
  try {
    await writeCache(BUFFER_KEY, buffer);
  } catch {
    // Storage full or unavailable. The in-memory buffer still flushes.
  }
};

/**
 * Sends what is buffered.
 *
 * On failure the events go back at the *front* of the buffer, so ordering
 * survives a flush that raced with new events arriving. On success the stored
 * copy is cleared rather than rewritten, because an empty buffer is the common
 * case and a delete is cheaper than a write of `[]`.
 */
export const flush = async (): Promise<void> => {
  if (flushing || buffer.length === 0) return;
  flushing = true;

  const batch = buffer.slice(0, MAX_BATCH);
  buffer = buffer.slice(batch.length);

  try {
    await api.post("/api/analytics/events", {
      events: batch,
      platform,
      appVersion,
    });
    if (buffer.length === 0) await removeCache(BUFFER_KEY);
    else await persist();
  } catch {
    // Offline, or signed out - the request carries no token and the server
    // answers 401. Either way the events are still worth keeping.
    buffer = [...batch, ...buffer].slice(-MAX_BUFFER);
    await persist();
  } finally {
    flushing = false;
  }
};

/**
 * Starts buffering and flushing. Called once, from the provider.
 *
 * Restores anything a previous run left behind before the first flush, so a
 * signup that was interrupted by a crash still reports the steps it reached.
 */
export const startAnalytics = (): (() => void) => {
  if (started) return () => {};
  started = true;

  void (async () => {
    const stored = await readCache<BufferedEvent[]>(BUFFER_KEY, []);
    if (Array.isArray(stored) && stored.length > 0) {
      buffer = [...stored, ...buffer].slice(-MAX_BUFFER);
    }
    void flush();
  })();

  timer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);

  // Backgrounding is the last moment anything is guaranteed to run, and it is
  // when a session's events are most complete.
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "background" || state === "inactive") void flush();
  });

  return () => {
    if (timer) clearInterval(timer);
    timer = null;
    subscription.remove();
    started = false;
  };
};

/**
 * Records something that is only interesting the first time it ever happens.
 *
 * `first_swipe` and `first_match` are milestones, not counters - the question
 * they answer is "did this account ever reach the thing the app is for", and a
 * `track()` on every swipe would answer a different one and cost a row each
 * time. The flag is per account, because a shared phone has two people on it
 * and the second one's first swipe is still a first swipe.
 *
 * Fails open: if the flag cannot be read, the event is sent. A duplicate
 * milestone is a counting nuisance; a missing one is a hole in the funnel.
 */
const seenThisLaunch = new Set<string>();

export const trackOnce = async (
  name: EventName,
  accountKey: string,
  props?: Props
): Promise<void> => {
  const key = `analytics-once:${name}:${accountKey}`;

  // Claimed synchronously, before the first `await`. The storage read is
  // asynchronous, so two calls in the same tick - a double-tap, or a swipe
  // handler and a button handler both firing - would both read "not yet seen"
  // and both send. This is the in-memory half of the flag; the stored half is
  // what survives a relaunch.
  if (seenThisLaunch.has(key)) return;
  seenThisLaunch.add(key);

  try {
    if (await readCache<boolean>(key, false)) return;
    track(name, props);
    await writeCache(key, true);
  } catch {
    track(name, props);
  }
};

/**
 * Forgets everything buffered, without sending it.
 *
 * Called on sign-out: events belong to the account that produced them, and a
 * buffer flushed after the next person signs in on a shared phone would write
 * one person's funnel against another's uid.
 */
export const resetAnalytics = async (): Promise<void> => {
  buffer = [];
  // Cleared too: the milestones are keyed by account, but a stale claim from
  // the previous session would silence the next person's genuine first swipe
  // for the rest of this launch.
  seenThisLaunch.clear();
  await removeCache(BUFFER_KEY);
};

export default { track, trackOnce, flush, startAnalytics, resetAnalytics };
