import api from "./axios";
import { UNDO, undo, sendSpotMessage, SPOT_ERRORS, audioSource, fetchNoticed, fetchSpotStatus } from "./spot";
import { removeWeight } from "./weight";
import { removeHealthRecord } from "./health";
import { saveSettings } from "./settings";

jest.mock("./axios", () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));
jest.mock("./weight", () => ({ removeWeight: jest.fn() }));
jest.mock("./health", () => ({ removeHealthRecord: jest.fn() }));
jest.mock("./settings", () => ({ saveSettings: jest.fn() }));
jest.mock("../config/env", () => ({ API_URL: "https://api.test" }));
jest.mock("../../utils/tokenutil", () => ({ getStoredToken: jest.fn(async () => "tok-1") }));

/**
 * The undo table is one of two copies: the server's tool file names the undo
 * kinds it can emit, and `backend/test/spotBlocks.test.js` reads this file
 * and fails if one of them is missing here. What this file proves is that
 * each handler goes through the ordinary API module.
 */

beforeEach(() => jest.clearAllMocks());

test("each undo goes through the ordinary API module", async () => {
  await undo({ undo: { kind: "removeWeight", petId: "p", entryId: "e" } });
  expect(removeWeight).toHaveBeenCalledWith("p", "e");

  await undo({ undo: { kind: "removeHealthRecord", petId: "p", recordId: "r" } });
  expect(removeHealthRecord).toHaveBeenCalledWith("p", "r");

  await undo({ undo: { kind: "updateSetting", set: { "units.weight": "lb", playdateRange: 25 } } });
  expect(saveSettings).toHaveBeenCalledWith({ units: { weight: "lb" }, playdateRange: 25 });

  api.put.mockResolvedValue({ data: {} });
  await undo({ undo: { kind: "restorePet", petId: "p", set: { breed: "Beagle", age: 3 } } });
  expect(api.put).toHaveBeenCalledWith("/api/pets/p", { breed: "Beagle", age: 3 });

  api.delete.mockResolvedValue({ data: { removed: true } });
  await undo({ undo: { kind: "forget", noteId: "n1" } });
  expect(api.delete).toHaveBeenCalledWith("/api/spot/notes/n1");

  api.post.mockResolvedValue({ data: { _id: "n2", text: "Bella hates storms" } });
  await undo({ undo: { kind: "remember", text: "Bella hates storms" } });
  expect(api.post).toHaveBeenCalledWith("/api/spot/notes", { text: "Bella hates storms" });

  api.delete.mockResolvedValue({ data: { removed: true } });
  await undo({ undo: { kind: "cancelReminder", reminderId: "r1" } });
  expect(api.delete).toHaveBeenCalledWith("/api/spot/reminders/r1");

  api.post.mockResolvedValue({ data: { reminderId: "r2" } });
  await undo({ undo: { kind: "restoreReminder", text: "walk", question: "Walked?", at: "2027-01-08T16:00:00.000Z", repeat: "daily", petId: null } });
  expect(api.post).toHaveBeenCalledWith("/api/spot/reminders", {
    text: "walk",
    question: "Walked?",
    at: "2027-01-08T16:00:00.000Z",
    repeat: "daily",
    petId: null,
    utcOffsetMinutes: expect.any(Number),
  });

  await expect(undo({ undo: { kind: "explode" } })).rejects.toThrow(/Cannot undo/);
  expect(Object.keys(UNDO).sort()).toEqual([
    "cancelReminder",
    "forget",
    "remember",
    "removeHealthRecord",
    "removeWeight",
    "restorePet",
    "restoreReminder",
    "updateSetting",
  ]);
});

test("a quota refusal comes back with its code and body on the error", async () => {
  const error = new Error("429");
  error.response = { status: 429, data: { code: "SPOT_QUOTA", used: 3, limit: 3, premium: false } };
  api.post.mockRejectedValue(error);

  await expect(sendSpotMessage("c1", { text: "hi" })).rejects.toMatchObject({
    code: SPOT_ERRORS.quota,
    body: { used: 3, limit: 3, premium: false },
  });
  expect(api.post).toHaveBeenCalledWith(
    "/api/spot/conversations/c1/messages",
    expect.objectContaining({ text: "hi", utcOffsetMinutes: expect.any(Number) })
  );
});

test("the audio source is the answer's route with the same bearer token every call carries", async () => {
  await expect(audioSource("c1", "m2")).resolves.toEqual({
    uri: "https://api.test/api/spot/conversations/c1/messages/m2/audio",
    headers: { Authorization: "Bearer tok-1" },
  });
});

test("noticed is a list or nothing, and the status carries whether a voice is configured", async () => {
  api.get.mockResolvedValueOnce({ data: [{ id: "x", kind: "weight", text: "t", question: "q", screen: "PetWeight", params: {} }] });
  await expect(fetchNoticed()).resolves.toHaveLength(1);
  api.get.mockResolvedValueOnce({ data: { message: "nope" } });
  await expect(fetchNoticed()).resolves.toEqual([]);
  api.get.mockResolvedValueOnce({ data: { enabled: true, consented: true, voice: true, quota: null } });
  await expect(fetchSpotStatus()).resolves.toMatchObject({ voice: true });
  api.get.mockResolvedValueOnce({ data: { enabled: true, consented: true, quota: null } });
  await expect(fetchSpotStatus()).resolves.toMatchObject({ voice: false });
});
