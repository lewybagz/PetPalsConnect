/** `@react-native-firebase/storage` has no web build. */
const storage = () => ({
  ref: () => ({
    putFile: async () => ({}),
    getDownloadURL: async () => "",
    delete: async () => {},
  }),
  refFromURL: () => ({ delete: async () => {} }),
});
export default storage;
export const getStorage = storage;
