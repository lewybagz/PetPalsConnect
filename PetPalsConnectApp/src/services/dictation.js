import { Alert } from "react-native";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

/**
 * The one way the app listens.
 *
 * Speech-to-text is the phone's: iOS's `SFSpeechRecognizer` and Android's
 * `SpeechRecognizer`, through `expo-speech-recognition`. The words land in
 * the text box and go to Spot the way typed words do; the audio never
 * reaches PetPals or Anthropic. It does reach Apple's or Google's dictation
 * service, which is the same path the keyboard's microphone key uses - and
 * that is what the sentence below says before the OS asks, the way
 * `services/location.js` explains location before the OS does.
 *
 * `startDictation` returns a stop function; results arrive through the
 * handlers, interim ones as the person speaks and one final one at the end.
 */

const explain = () =>
  new Promise((resolve) => {
    Alert.alert(
      "Speak to Spot?",
      "Your phone's dictation service (Apple's or Google's) hears what you say " +
        "and turns it into text. The text goes to Spot like a typed message; " +
        "the audio never reaches PetPals.\n\n" +
        "You can revoke the microphone permission in your phone's settings at any time.",
      [
        { text: "Not now", style: "cancel", onPress: () => resolve(false) },
        { text: "Continue", onPress: () => resolve(true) },
      ],
      { cancelable: false }
    );
  });

/** "granted", "denied", or the OS status when it can no longer be asked. */
export const requestDictationPermission = async () => {
  const existing = await ExpoSpeechRecognitionModule.getPermissionsAsync();
  if (existing.granted) return "granted";
  if (existing.canAskAgain === false) return existing.status ?? "denied";

  if (!(await explain())) return "denied";

  const { status } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  return status;
};

/** Whether this phone has a recognition service at all. */
export const dictationAvailable = () => {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
};

const ERROR_SENTENCES = {
  "not-allowed": "Allow the microphone in your phone's settings to speak to Spot.",
  "service-not-allowed":
    "Dictation is turned off on this phone. Turn on Siri & Dictation, or the Google app, and try again.",
  "language-not-supported": "This phone's dictation doesn't support English yet.",
  "no-speech": "Spot didn't catch that. Try again.",
  network: "Dictation needs a connection just now.",
  // A deliberate stop is not an error to show anybody.
  aborted: null,
};

/** One plain sentence per error code the module can raise; null for a deliberate stop. */
export const describeDictationError = (code) =>
  Object.hasOwn(ERROR_SENTENCES, code) ? ERROR_SENTENCES[code] : "Spot couldn't listen just now.";

/**
 * Listens once. `onInterim(text)` as words arrive, `onFinal(text)` once,
 * `onError(sentence)` for anything but a deliberate stop, `onEnd()` always.
 * Returns a function that stops listening.
 */
export const startDictation = ({ lang = "en-US", onInterim, onFinal, onError, onEnd } = {}) => {
  let finished = false;
  const subscriptions = [];
  const finish = () => {
    if (finished) return;
    finished = true;
    subscriptions.forEach((subscription) => subscription.remove());
    onEnd?.();
  };

  subscriptions.push(
    ExpoSpeechRecognitionModule.addListener("result", (event) => {
      const transcript = event?.results?.[0]?.transcript ?? "";
      if (event?.isFinal) onFinal?.(transcript);
      else onInterim?.(transcript);
    }),
    ExpoSpeechRecognitionModule.addListener("error", (event) => {
      const sentence = describeDictationError(event?.error);
      if (sentence) onError?.(sentence);
    }),
    ExpoSpeechRecognitionModule.addListener("end", finish)
  );

  ExpoSpeechRecognitionModule.start({ lang, interimResults: true, continuous: false, maxAlternatives: 1 });

  return () => {
    ExpoSpeechRecognitionModule.stop();
  };
};
