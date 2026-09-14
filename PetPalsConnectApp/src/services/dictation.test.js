import { Alert } from "react-native";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

import {
  describeDictationError,
  dictationAvailable,
  requestDictationPermission,
  startDictation,
} from "./dictation";

jest.mock("expo-speech-recognition", () => {
  const listeners = new Map();
  return {
    ExpoSpeechRecognitionModule: {
      addListener: jest.fn((event, fn) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(fn);
        return { remove: jest.fn(() => listeners.get(event).delete(fn)) };
      }),
      emit: (event, payload) => [...(listeners.get(event) ?? [])].forEach((fn) => fn(payload)),
      listenerCount: (event) => listeners.get(event)?.size ?? 0,
      getPermissionsAsync: jest.fn(),
      requestPermissionsAsync: jest.fn(),
      isRecognitionAvailable: jest.fn(() => true),
      start: jest.fn(),
      stop: jest.fn(),
      abort: jest.fn(),
    },
  };
});

/**
 * The disclosure comes before the OS prompt, "Not now" means no without the
 * OS being asked, and the transcript reaches the handlers in the shape the
 * screen relies on. A test here that passed with the sentence after the
 * prompt, or with the OS asked on "Not now", would be worth nothing.
 */

const M = ExpoSpeechRecognitionModule;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

const answerAlert = (buttonText) => {
  const buttons = Alert.alert.mock.calls[0][2];
  buttons.find((button) => button.text === buttonText).onPress();
};

test("already granted: no sentence, no prompt", async () => {
  M.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true, status: "granted" });
  await expect(requestDictationPermission()).resolves.toBe("granted");
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(M.requestPermissionsAsync).not.toHaveBeenCalled();
});

test("the sentence comes first, and Continue is what asks the OS", async () => {
  M.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true, status: "undetermined" });
  M.requestPermissionsAsync.mockResolvedValue({ granted: true, status: "granted" });
  const pending = requestDictationPermission();
  await Promise.resolve();
  await Promise.resolve();
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  expect(Alert.alert.mock.calls[0][1]).toMatch(/dictation service \(Apple's or Google's\)/);
  expect(Alert.alert.mock.calls[0][1]).toMatch(/audio never reaches PetPals/);
  expect(M.requestPermissionsAsync).not.toHaveBeenCalled();
  answerAlert("Continue");
  await expect(pending).resolves.toBe("granted");
  expect(M.requestPermissionsAsync).toHaveBeenCalledTimes(1);
});

test("Not now is a no, and the OS is never asked", async () => {
  M.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true, status: "undetermined" });
  const pending = requestDictationPermission();
  await Promise.resolve();
  await Promise.resolve();
  answerAlert("Not now");
  await expect(pending).resolves.toBe("denied");
  expect(M.requestPermissionsAsync).not.toHaveBeenCalled();
});

test("refused for good means the OS status, with no sentence and no prompt", async () => {
  M.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false, status: "denied" });
  await expect(requestDictationPermission()).resolves.toBe("denied");
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(M.requestPermissionsAsync).not.toHaveBeenCalled();
});

test("listening: interim words, then the final ones, then the listeners are gone", () => {
  const onInterim = jest.fn();
  const onFinal = jest.fn();
  const onEnd = jest.fn();
  const stop = startDictation({ onInterim, onFinal, onEnd });

  expect(M.start).toHaveBeenCalledWith({ lang: "en-US", interimResults: true, continuous: false, maxAlternatives: 1 });
  M.emit("result", { isFinal: false, results: [{ transcript: "is bella" }] });
  M.emit("result", { isFinal: false, results: [{ transcript: "is bella due" }] });
  expect(onInterim.mock.calls.map((call) => call[0])).toEqual(["is bella", "is bella due"]);
  expect(onFinal).not.toHaveBeenCalled();

  M.emit("result", { isFinal: true, results: [{ transcript: "is Bella due for anything" }] });
  expect(onFinal).toHaveBeenCalledWith("is Bella due for anything");

  M.emit("end", null);
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(M.listenerCount("result")).toBe(0);
  expect(M.listenerCount("error")).toBe(0);

  stop();
  expect(M.stop).toHaveBeenCalledTimes(1);
});

test("an error is a sentence a person can act on, and a deliberate stop is silence", () => {
  const onError = jest.fn();
  startDictation({ onError });
  M.emit("error", { error: "not-allowed" });
  M.emit("error", { error: "service-not-allowed" });
  M.emit("error", { error: "aborted" });
  M.emit("error", { error: "something-new" });
  expect(onError.mock.calls.map((call) => call[0])).toEqual([
    "Allow the microphone in your phone's settings to speak to Spot.",
    "Dictation is turned off on this phone. Turn on Siri & Dictation, or the Google app, and try again.",
    "Spot couldn't listen just now.",
  ]);
  expect(describeDictationError("aborted")).toBeNull();
  M.emit("end", null);
});

test("availability is the module's answer, and a throwing module is 'no'", () => {
  expect(dictationAvailable()).toBe(true);
  M.isRecognitionAvailable.mockImplementation(() => {
    throw new Error("no native module");
  });
  expect(dictationAvailable()).toBe(false);
});
