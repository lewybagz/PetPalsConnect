/**
 * `@react-native-firebase/auth` has no web build.
 *
 * `currentUser` is null, so `src/api/axios` sends no Authorization header and
 * the gallery's fixture layer answers every request. Nothing here pretends to
 * authenticate: a stub that returned a fake user would make the screens claim a
 * session that does not exist.
 */
const noop = async () => {
  throw new Error("Firebase Auth is not available on web");
};

const auth = () => ({ currentUser: null });

export default auth;
export const getAuth = () => ({ currentUser: null, signOut: async () => {} });
export const onAuthStateChanged = (_auth, callback) => {
  callback(null);
  return () => {};
};
export const signInWithEmailAndPassword = noop;
export const createUserWithEmailAndPassword = noop;
export const sendEmailVerification = noop;
export const sendPasswordResetEmail = noop;
export const signInWithCredential = noop;
export const updatePassword = noop;
export const GoogleAuthProvider = { credential: () => ({}) };
export const PhoneAuthProvider = function PhoneAuthProvider() {};
