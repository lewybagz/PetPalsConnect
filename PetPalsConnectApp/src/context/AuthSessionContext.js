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
import { isAppleAccount, revokeAppleAccess } from "../api/appleAuth";
import { readCache, writeCache, removeCache, CacheKeys } from "../services/localCache";
import { isLaunched } from "../api/waitlist";
import { track, startAnalytics, resetAnalytics } from "../services/analytics";

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
 *   waitlisted   - the profile's ZIP is outside the launch region; a screen
 *                  with a "notify me" button, and a way through to the care hub
 *   needsIntro   - everything is set up, but this account has not been shown
 *                  the app yet; one screen, then Discover
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
  waitlisted: "waitlisted",
  needsIntro: "needsIntro",
  ready: "ready",
  error: "error",
};

/**
 * `pets` arrives populated from /api/users/me, but tolerate an id-only array
 * (or a cached profile from an older shape) - all we need is "is it empty?".
 */
const profileHasPet = (profile) =>
  Array.isArray(profile?.pets) && profile.pets.length > 0;

/**
 * The species playdates are for. Mirrors `MATCHABLE_SPECIES` on the server.
 */
const MATCHABLE_SPECIES = "dog";

/**
 * Whether the profile holds a pet that can actually match.
 *
 * A profile can hold a cat, a rabbit or a bearded dragon - they are there so
 * the care hub has something to work from - but playdates are dogs only, and
 * the server's deck filters to `dog`. So `hasPet` is no longer the right
 * question for a matching screen: a cat-only owner passes `hasPet`, walks into
 * Discover and finds an empty deck with nothing explaining why. `hasDog` is
 * what those screens gate on.
 *
 * A pet with no `species` is a dog: the field was added after rows existed, and
 * at the time there was nothing else a pet could be. An id-only `pets` array
 * (an older cached profile) is treated the same way rather than as "no dog",
 * because walling a real dog owner out of the app on a stale cache is far worse
 * than briefly showing a cat owner a deck they cannot swipe.
 */
const profileHasDog = (profile) =>
  Array.isArray(profile?.pets) &&
  profile.pets.some(
    (pet) =>
      typeof pet !== "object" ||
      pet === null ||
      !pet.species ||
      pet.species === MATCHABLE_SPECIES
  );

/** Per-user, so skipping on one account does not silence the prompt on another. */
const skipKey = (profile) => `pet-setup-skipped:${profile?._id ?? "unknown"}`;

/**
 * "Continue anyway" past the launch fence, remembered per user.
 *
 * The fence is not a refusal: an out-of-area owner can still add a pet and
 * use the care hub, which is the half of the app the research says is the
 * durable one. Nothing server-side turns them away; this is a session state
 * and one screen.
 */
const continueKey = (profile) => `launch-continue:${profile?._id ?? "unknown"}`;

/**
 * Whether this account has been shown the app once, remembered per user.
 *
 * Finishing onboarding used to drop somebody on Home - shelves of other
 * people's pets, an empty favourites row and an article - with nothing taking
 * them to Discover, which is the one screen the product is about. The tour
 * only auto-starts on Home, More and Favourites, so a new user's first
 * destination was the least representative screen in the app.
 *
 * Per user for the same reason the other two flags are: a shared phone has two
 * people on it, and the second one has not seen anything.
 */
const introKey = (profile) => `intro-seen:${profile?._id ?? "unknown"}`;

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
const statusForProfile = (profile, skipped, continued = false, introSeen = true) => {
  if (profile?.suspended) return STATUS.suspended;
  // Outside the launch region, and has not chosen to go on regardless. A
  // profile with no region predates the field and is let in.
  if (!isLaunched(profile?.region) && !continued) return STATUS.waitlisted;
  if (!profileHasPet(profile) && !skipped) return STATUS.needsPet;
  // Last, and only once everything else has cleared. The order is the point:
  // an intro before the suspension or waitlist checks would welcome somebody
  // to an app that is about to refuse them, and an intro before the pet gate
  // would introduce a deck they cannot use yet.
  if (!introSeen) return STATUS.needsIntro;
  return STATUS.ready;
};

export const AuthSessionProvider = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState(STATUS.loading);
  const [error, setError] = useState(null);
  const [skippedPetSetup, setSkippedPetSetup] = useState(false);
  const [continuedPastFence, setContinuedPastFence] = useState(false);
  // Defaults to true so an existing account never flashes the intro while the
  // stored flag is still being read - only a genuine "no" moves them there.
  const [introSeen, setIntroSeen] = useState(true);

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
      const continued = Boolean(await readCache(continueKey(data), false));
      const seen = Boolean(await readCache(introKey(data), false));

      setProfile(data);
      setSkippedPetSetup(skipped);
      setContinuedPastFence(continued);
      setIntroSeen(seen);
      setError(null);
      setStatus(statusForProfile(data, skipped, continued, seen));
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
        const continued = Boolean(await readCache(continueKey(cached), false));
        const seen = Boolean(await readCache(introKey(cached), false));
        setProfile(cached);
        setSkippedPetSetup(skipped);
        setContinuedPastFence(continued);
        setIntroSeen(seen);
        setStatus(statusForProfile(cached, skipped, continued, seen));
        return cached;
      }

      setError(err.message ?? "Could not reach PetPals Connect.");
      setStatus(STATUS.error);
      return null;
    }
  }, []);

  // Buffering and flushing, for the whole life of the app. Started here rather
  // than in App.js because this provider already wraps everything that could
  // raise an event, and sign-out - which has to clear the buffer - lives here.
  useEffect(() => startAnalytics(), []);

  useEffect(() => {
    track("app_opened");
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

      track("profile_created");
      setProfile(data);
      setError(null);
      // A profile created just now has no pets and cannot have a stored skip,
      // so this always moves to the add-a-pet prompt - and it has certainly
      // not seen the intro, which is what it reaches after the pet step.
      setSkippedPetSetup(false);
      setIntroSeen(false);
      setStatus(statusForProfile(data, false, false, false));
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
      track("pet_created", { species: pet?.species ?? "unknown" });
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
    track("pet_skipped");
    if (profile) await writeCache(skipKey(profile), true);
    setSkippedPetSetup(true);
    // Not straight to `ready`: somebody who skipped the pet step still has not
    // seen the app, and the intro is where the care hub - the half that works
    // without a pet - is pointed out to them.
    setStatus(statusForProfile(profile, true, continuedPastFence, introSeen));
  }, [profile, continuedPastFence, introSeen]);

  /**
   * Goes on past the launch fence. Remembered per user so the screen is not
   * shown again on every launch; the deck stays honest and empty.
   */
  const continueAnyway = useCallback(async () => {
    if (profile) await writeCache(continueKey(profile), true);
    setContinuedPastFence(true);
    setStatus(statusForProfile(profile, skippedPetSetup, true, introSeen));
  }, [profile, skippedPetSetup, introSeen]);

  /**
   * The forms are behind them, once per launch.
   *
   * `needsIntro` counts as well as `ready`, because onboarding is the three
   * writes - account, profile, pet - and the intro is the app, not a fourth
   * form. Measuring this at `ready` alone would report every new user's
   * onboarding as finishing one screen later than it does, and would report
   * somebody who quit on the intro as never having finished at all.
   *
   * Derived rather than raised at a call site because there are several ways
   * to arrive: finishing the pet form, skipping it, continuing past the launch
   * fence, and simply signing in with everything already done. A `track()` in
   * each is that many places to forget one.
   *
   * `reportedReady` keeps it to once per launch rather than once per profile
   * re-read - the session re-reads on suspension, on revocation and after
   * adding a pet, and none of those is a new user finishing onboarding.
   */
  const reportedReady = useRef(false);
  useEffect(() => {
    if (reportedReady.current) return;
    if (status !== STATUS.ready && status !== STATUS.needsIntro) return;
    reportedReady.current = true;
    track("onboarding_completed");
  }, [status]);

  /**
   * Leaves the intro and enters the app, remembered per user.
   *
   * Written however the intro ended, including a skip: somebody who dismissed
   * it has said something, and the answer was no. Same rule the walkthrough
   * already follows for `seen`.
   */
  const finishIntro = useCallback(async () => {
    if (profile) await writeCache(introKey(profile), true);
    setIntroSeen(true);
    setStatus(statusForProfile(profile, skippedPetSetup, continuedPastFence, true));
  }, [profile, skippedPetSetup, continuedPastFence]);

  const refresh = useCallback(
    () => loadProfile(getAuth().currentUser),
    [loadProfile]
  );

  const signOut = useCallback(async () => {
    // Before the auth state changes: a buffer flushed after the next person
    // signs in on a shared phone would write one person's funnel as another's.
    await resetAnalytics();
    await removeCache(CacheKeys.userData);
    await getAuth().signOut();
  }, []);

  /** Permanently deletes the profile and the Firebase account. */
  const deleteAccount = useCallback(async () => {
    // Apple requires the Sign in with Apple grant revoked when the account
    // goes (5.1.1(v)). It prompts once more; a dismissed prompt rejects here
    // and the account stays, because deleting without revoking is the thing
    // the rule exists to stop.
    if (isAppleAccount(getAuth().currentUser)) await revokeAppleAccess();
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
      // ...and `hasPet` does not imply a pet that can match. Matching screens
      // want this one.
      hasDog: profileHasDog(profile),
      skippedPetSetup,
      continuedPastFence,
      introSeen,
      createProfile,
      createPet,
      skipPetSetup,
      continueAnyway,
      finishIntro,
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
      continuedPastFence,
      introSeen,
      createProfile,
      createPet,
      skipPetSetup,
      continueAnyway,
      finishIntro,
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
