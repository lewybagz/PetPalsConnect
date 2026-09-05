/* eslint-env jest */

/**
 * Mocks for the native modules the app imports at load time.
 *
 * These are the boundaries the tests deliberately do not exercise: Firebase,
 * device storage and the image picker. Everything inside them - the session
 * state machine, the API client's behaviour, the screens - is real code.
 */

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// A controllable stand-in for Firebase Auth. Tests drive it through
// `__setCurrentUser` and `__emitAuthState`.
jest.mock("@react-native-firebase/auth", () => {
  let currentUser = null;
  let listener = null;

  const auth = () => ({ currentUser });

  // One object, not a fresh one per call, so a test can reach for
  // `getAuth().__setToken(...)` and have it apply to what the code under test
  // sees. The socket handshake asks for a token on every reconnect.
  const instance = {
    get currentUser() {
      return currentUser;
    },
    signOut: jest.fn(async () => {
      currentUser = null;
      listener?.(null);
    }),
    /** Test seam: stand up a signed-in user whose ID token is `token`. */
    __setToken: (token) => {
      currentUser = token
        ? { uid: "test-uid", getIdToken: jest.fn(async () => token) }
        : null;
    },
  };

  return {
    __esModule: true,
    default: auth,
    getAuth: () => instance,
    onAuthStateChanged: (_auth, callback) => {
      listener = callback;
      callback(currentUser);
      return () => {
        listener = null;
      };
    },
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    sendEmailVerification: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    signInWithCredential: jest.fn(),
    GoogleAuthProvider: { credential: jest.fn(() => ({})) },
    PhoneAuthProvider: jest.fn(),
    __setCurrentUser: (user) => {
      currentUser = user;
    },
    __emitAuthState: (user) => {
      currentUser = user;
      listener?.(user);
    },
  };
});

jest.mock("@react-native-firebase/storage", () => ({
  __esModule: true,
  default: () => ({
    ref: () => ({
      putFile: jest.fn(async () => {}),
      getDownloadURL: jest.fn(async () => "https://example.test/photo.jpg"),
    }),
  }),
}));

jest.mock("@react-native-firebase/messaging", () => ({
  __esModule: true,
  default: () => ({}),
  getMessaging: () => ({}),
  getToken: jest.fn(async () => "fcm-token"),
  onMessage: jest.fn(() => jest.fn()),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn(async () => null),
  requestPermission: jest.fn(async () => 1),
  AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2 },
}));

jest.mock("@react-native-firebase/app", () => ({
  getApp: () => ({}),
}));

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(),
  },
}));

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

/**
 * Safe-area insets.
 *
 * `useSafeAreaInsets()` throws outside a `SafeAreaProvider`, and the `Screen`
 * primitive calls it - so without this every screen test would have to mount
 * the provider to assert anything at all. Real device values, so a test that
 * cares about the inset (`ui.test.js`) can override this with its own mock and
 * everything else just works.
 */
jest.mock("react-native-safe-area-context", () => {
  const insets = { top: 47, bottom: 34, left: 0, right: 0 };
  return {
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    SafeAreaInsetsContext: {
      Consumer: ({ children }) => children(insets),
      Provider: ({ children }) => children,
    },
    initialWindowMetrics: { insets, frame: { x: 0, y: 0, width: 390, height: 844 } },
  };
});

/**
 * Reanimated, without its native half.
 *
 * Reanimated 4 loads `react-native-worklets`, which calls `loadUnpackers()` on
 * a TurboModule that does not exist under Jest - so merely *importing* a screen
 * with a gesture on it took the whole suite down before a single test ran. That
 * fails at suite level, which is reported separately from test failures and is
 * easy to read straight past in a summary line.
 *
 * Reanimated ships `react-native-reanimated/mock`, and it does not help: the
 * mock itself imports the package's real entry point, so it hits the same
 * TurboModule. This is a hand-rolled double for the five APIs the app actually
 * uses, in the same spirit as the Firebase stubs above.
 *
 * `useAnimatedStyle` runs its worklet once and returns a plain style object, so
 * the resting appearance of an animated view is real. Nothing animates, which
 * is why the swipe thresholds live in `swipeDecision.js` as pure functions
 * rather than inside the gesture handlers - a pan cannot be simulated here.
 */
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");

  // Gesture-handler asks Reanimated for this to build its own wrapper, so the
  // double has to offer it or importing `GestureDetector` throws.
  const createAnimatedComponent = (Component) => Component;

  return {
    __esModule: true,
    default: { View, createAnimatedComponent },
    createAnimatedComponent,
    // A plain mutable box. Writing `.value` does not re-render, which matches
    // the real thing: shared values live off the React tree on purpose.
    useSharedValue: (initial) => ({ value: initial }),
    useAnimatedStyle: (worklet) => worklet(),
    useDerivedValue: (worklet) => ({ value: worklet() }),
    // Animations resolve instantly to their target. `withTiming` runs its
    // completion callback so a test can drive the commit path if it needs to.
    withTiming: (toValue, _config, callback) => {
      callback?.(true);
      return toValue;
    },
    withSpring: (toValue) => toValue,
    // On a device this hops from the UI thread back to JS; here there is only
    // the one thread, so the function is already callable.
    runOnJS: (fn) => fn,
    interpolate: (value) => value,
    Extrapolation: { CLAMP: "clamp" },

    // Gesture-handler drives `GestureDetector` through Reanimated's event
    // plumbing when it is installed. None of it does anything without the UI
    // thread; it only has to exist so the detector mounts and renders its
    // child, which is all a test can observe anyway.
    useEvent: () => ({}),
    useHandler: () => ({ context: {}, doDependenciesDiffer: false }),
    useComposedEventHandler: () => ({}),
    setGestureState: () => {},
    isSharedValue: (value) =>
      Boolean(value && typeof value === "object" && "value" in value),
    makeMutable: (value) => ({ value }),
    cancelAnimation: () => {},
    startMapper: () => 0,
    stopMapper: () => {},
    runOnUI: (fn) => fn,
  };
});

require("react-native-gesture-handler/jestSetup");

// A socket that never opens a connection.
//
// `useSocketEvents` reaches `services/socket`, which creates a real socket.io
// client on first use. Any suite that renders a screen with a live-update hook
// therefore opened a network handle and Jest hung after the run with "Jest did
// not exit one second after the test run has completed" - a green suite that
// never returns, which in CI is a timeout rather than a failure. `socket.test.js`
// declares its own mock, which takes precedence for that file.
jest.mock("socket.io-client", () => {
  const listeners = new Map();
  const socket = {
    connected: true,
    id: "test-socket",
    emit: jest.fn(),
    on: jest.fn((event, handler) => {
      listeners.set(event, handler);
      return socket;
    }),
    off: jest.fn((event) => {
      listeners.delete(event);
      return socket;
    }),
    disconnect: jest.fn(),
    close: jest.fn(),
  };
  return { io: jest.fn(() => socket), __socket: socket };
});

// Quieten the expected console noise from error-path tests.
global.__DEV__ = true;

// Explicit unmount between tests. RTL's automatic cleanup is not reliably wired
// in this version, which left `screen` pointing at a previous test's render and
// made later tests assert against a stale tree.
const { cleanup, configure } = require("@testing-library/react-native");

// RTL's async helpers default to a 1s budget of their own, separate from
// jest's test timeout. On a cold cache the first `render()` in a run triggers
// the Babel transform of a large dependency tree lazily, which blows that
// budget and fails with "`render` function has not been called" - a suite that
// passes on every warm re-run and fails the first time CI sees it. It is a
// ceiling, not a delay: a passing assertion still resolves immediately.
configure({ asyncUtilTimeout: 10000 });
afterEach(() => {
  cleanup();
});
