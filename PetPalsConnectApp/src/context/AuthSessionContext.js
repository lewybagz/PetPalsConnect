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
 *   needsProfile - Firebase user, but no Mongo profile yet (resume onboarding)
 *   ready        - both exist
 *   error        - profile lookup failed for a reason that isn't "absent"
 */

const AuthSessionContext = createContext(null);

const STATUS = {
  loading: "loading",
  signedOut: "signedOut",
  needsProfile: "needsProfile",
  ready: "ready",
  error: "error",
};

export const AuthSessionProvider = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState(STATUS.loading);
  const [error, setError] = useState(null);

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

      setProfile(data);
      setError(null);
      setStatus(STATUS.ready);
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
        setProfile(cached);
        setStatus(STATUS.ready);
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

  /** Creates the Mongo profile for the current Firebase account. */
  const createProfile = useCallback(
    async (details) => {
      const { data } = await api.post("/api/users", details);
      setProfile(data);
      setError(null);
      setStatus(STATUS.ready);
      writeCache(CacheKeys.userData, data);
      return data;
    },
    []
  );

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
      createProfile,
      refresh,
      signOut,
      deleteAccount,
    }),
    [status, error, firebaseUser, profile, createProfile, refresh, signOut, deleteAccount]
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
