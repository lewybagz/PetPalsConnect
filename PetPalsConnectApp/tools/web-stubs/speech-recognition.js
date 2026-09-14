/**
 * `expo-speech-recognition` for the gallery build only.
 *
 * The real module's web path wants the browser's `SpeechRecognition`, which
 * headless Chromium does not offer, and the gallery is for looking at the
 * screens, not for talking to them. This one never listens: permissions are
 * "denied and cannot be asked", `start()` raises `not-allowed`, and the mic
 * button renders exactly as it would on a phone that said no.
 */
const listeners = new Map();

const emit = (event, payload) => {
  for (const listener of listeners.get(event) ?? []) listener(payload);
};

export const ExpoSpeechRecognitionModule = {
  addListener(event, listener) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(listener);
    return { remove: () => listeners.get(event)?.delete(listener) };
  },
  async getPermissionsAsync() {
    return { granted: false, canAskAgain: false, status: "denied" };
  },
  async requestPermissionsAsync() {
    return { granted: false, canAskAgain: false, status: "denied" };
  },
  isRecognitionAvailable: () => false,
  start() {
    emit("error", { error: "not-allowed" });
    emit("end", null);
  },
  stop() {},
  abort() {},
};

export const useSpeechRecognitionEvent = () => {};
