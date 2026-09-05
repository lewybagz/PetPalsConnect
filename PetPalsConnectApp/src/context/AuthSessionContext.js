import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";

import api from "../api/axios";
import { onSessionInvalidated } from "../api/sessionEvents";
import { readCache, writeCache, removeCache, CacheKeys } from "../services/localCache";

/**
 * The app's notion of "who is signed in".
 *
 * Signing up is two steps that cannot be made atomic: create the Firebase
 * account, then create the Mongo profile. Anything in between - a crash, a
 * dropped connection, the API being down, the user force-quitting - used to
 * leave a *zombie account*: authenticated forever, no profile, every screen
 * 404ing, and signing up again refused with "email already in use".
 *
 * So profile existence is part of the session rather than something a single
 * screen happens to do once. The status below drives navigation, which makes an
 * interrupted signup a resumable step instead of a dead end, and gives Google
 * sign-in the same profile bootstrap without duplicating it.
 *
 *   loading      - still resolving Firebase and/or the profile
 *   signedOut    - no Firebase user
 *   needsProfile - Firebase user, but no Mongo profile yet
 *   needsPet     - profile exists, but no pets yet and the prompt wasn't skipped
 *   suspended    - the account is hidden pending review; the API refuses it
 *                  nearly everything, so the app must not pretend otherwise
 *   ready        - the app can be entered
 *   error        - profile lookup failed for a reason that isn't "absent"
 *
 * Onboarding is a sequence of these states rather than a screen that runs once,
 * so it resumes correctly wherever it was interrupted.
 *
 * `needsPet` is a prompt, not a wall: it can be skipped, and the choice is
 * remembered per user so it is not asked again on every launch. That means
 * `ready` does NOT imply the user has a pet - screens that need one must handle
 * its absence. `hasPet` on the context is the check to use.
 */

const AuthSessionContext = createContext(null);

const STATUS = {
  loading: "loading",
  signedOut: "signedOut",
  needsProfile: "needsProfile",
  needsPet: "needsPet",
  suspended: "suspended",
  ready: "ready",
  error: "error",
};

/**
 * `pets` arrives populated from /api/users/me, but tolerate an id-only array
 * (or a cached profile from an older shape) - all we need is "is it empty?".
 */
const profileHasPet = (profile) =>
  Array.isArray(profile?.pets) && profile.pets.length > 0;

/** Per-user, so skipping on one account does not silence the prompt on another. */
const skipKey = (profile) => `pet-setup-skipped:${profile?._id ?? "unknown"}`;

/**
 * The onboarding step a profile still needs, if any.
 *
 * Having a pet always wins over a stored skip, so adding one later clears the
 * prompt without needing the flag tidied up first.
 */
/**
 * Suspension is a session state, not an error.
 *
 * The API refuses a suspended account nearly everything, so without this the
 * app rendered its normal tree and turned every screen into a failed request
 * and a toast that said nothing about why. It is the same shape as the other
 * gates: a state the session reports, and one tree the navigator picks from it.
 */
const statusForProfile = (profile, skipped) => {
  if (profile?.suspended) return STATUS.suspended;
  return profileHasPet(profile) || skipped ? STATUS.ready : STATUS.needsPet;
};

export const AuthSessionProvider = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState(STATUS.loading);
  const [error, setError] = useState(null);
  const [skippedPetSetup, setSkippedPetSetup] = useState(false);

  // Guards against a slow response for a previous user overwriting a newer one.
  const requestId = useRef(0);

  const loadProfile = useCallback(async (user) => {
    if (!user) {
      setProfile(null);
      setStatus(STATUS.signedOut);
      return null;
    }

    const id = ++requestId.current;
    try {
      const { data } = await api.get("/api/users/me");
      if (id !== requestId.current) return null;

      const skipped = profileHasPet(data)
        ? false
        : Boolean(await readCache(skipKey(data), false));

      setProfile(data);
      setSkippedPetSetup(skipped);
      setError(null);
      setStatus(statusForProfile(data, skipped));
      writeCache(CacheKeys.userData, data);
      return data;
    } catch (err) {
      if (id !== requestId.current) return null;

      // 404 is the expected "signed up but never finished" case, not a failure.
      if (err.response?.status === 404) {
        setProfile(null);
        setError(null);
        setStatus(STATUS.needsProfile);
        return null;
      }

      // Anything else (offline, API down) - fall back to the cached profile so
      // the app still opens, rather than trapping the user on a spinner.
      const cached = await readCache(CacheKeys.userData);
      if (cached) {
        const skipped = profileHasPet(cached)
          ? false
          : Boolean(await readCache(skipKey(cached), false));
        setProfile(cached);
        setSkippedPetSetup(skipped);
        setStatus(statusForProfile(cached, skipped));
        return cached;
      }

      setError(err.message ?? "Could not reach PetPals Connect.");
      setStatus(STATUS.error);
      return null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), (user) => {
      setFirebaseUser(user);
      setStatus(STATUS.loading);
      loadProfile(user);
    });
    return unsubscribe;
  }, [loadProfile]);

  /**
   * The server can end a session while the app is open - an account suspended
   * by a third report, a token revoked after a phone was stolen. The API client
   * says so; re-reading the profile is what decides the new state, because the
   * interceptor knows only that something changed.
   *
   * Without this the app kept its normal tree and turned every screen into a
   * failed request with a toast that explained nothing.
   */
  useEffect(
    () =>
      onSessionInvalidated(() => {
        loadProfile(getAuth().currentUser);
      }),
    [loadProfile]
  );

  /** Creates the Mongo profile for the current Firebase account. */
  const createProfile = useCallback(
    async (details) => {
      const { data } = await api.post("/api/users", details);

      setProfile(data);
      setError(null);
      // A profile created just now has no pets and cannot have a stored skip,
      // so this always moves to the add-a-pet prompt.
      setSkippedPetSetup(false);
      setStatus(statusForProfile(data, false));
      writeCache(CacheKeys.userData, data);
      return data;
    },
    []
  );

  /**
   * Creates a pet for the current user and re-reads the profile so the gate
   * moves on. The server owns the profile link, so refreshing is what makes the
   * new pet visible to the session rather than patching local state.
   */
  const createPet = useCallback(
    async (pet) => {
      const { data } = await api.post("/api/pets", pet);
      // Adding a pet answers the prompt, so drop any stored skip.
      if (profile) await removeCache(skipKey(profile));
      await loadProfile(getAuth().currentUser);
      return data.pet;
    },
    [loadProfile, profile]
  );

  /**
   * Dismisses the add-a-pet prompt and lets the user into the app.
   *
   * Persisted so it is not asked again on every launch - a skip that forgets
   * itself is just a slower wall. Screens that need a pet check `hasPet` and
   * offer to add one instead.
   */
  const skipPetSetup = useCallback(async () => {
    if (profile) await writeCache(skipKey(profile), true);
    setSkippedPetSetup(true);
    setStatus(STATUS.ready);
  }, [profile]);

  const refresh = useCallback(
    () => loadProfile(getAuth().currentUser),
    [loadProfile]
  );

  const signOut = useCallback(async () => {
    await removeCache(CacheKeys.userData);
    await getAuth().signOut();
  }, []);

  /** Permanently deletes the profile and the Firebase account. */
  const deleteAccount = useCallback(async () => {
    await api.delete("/api/users/me");
    await removeCache(CacheKeys.userData);
    try {
      await getAuth().signOut();
    } catch {
      // The account is gone server-side; a failed local sign-out is harmless.
    }
  }, []);

  const value = useMemo(
    () => ({
      status,
      error,
      firebaseUser,
      profile,
      userId: profile?._id ?? null,
      isSignedIn: !!firebaseUser,
      // `ready` does not imply a pet exists - the prompt is skippable.
      hasPet: profileHasPet(profile),
      skippedPetSetup,
      createProfile,
      createPet,
      skipPetSetup,
      refresh,
      signOut,
      deleteAccount,
    }),
    [
      status,
      error,
      firebaseUser,
      profile,
      skippedPetSetup,
      createProfile,
      createPet,
      skipPetSetup,
      refresh,
      signOut,
      deleteAccount,
    ]
  );

  return (
    <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
  );
};

export const useAuthSession = () => {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error("useAuthSession must be used inside an AuthSessionProvider");
  }
  return context;
};

export { STATUS as AuthStatus };

/**
 * The raw context, so the screenshot gallery can supply a session without
 * standing up Firebase. Nothing in the app imports it - screens use
 * `useAuthSession`, which is what enforces the provider.
 */
export { AuthSessionContext };
