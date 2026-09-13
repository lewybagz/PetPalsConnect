import api from "./axios";
import { UNDO, undo, sendSpotMessage, SPOT_ERRORS } from "./spot";
import { removeWeight } from "./weight";
import { removeHealthRecord } from "./health";
import { saveSettings } from "./settings";

jest.mock("./axios", () => ({ get: jest.fn(), post: jest.fn(), delete: jest.fn() }));
jest.mock("./weight", () => ({ removeWeight: jest.fn() }));
jest.mock("./health", () => ({ removeHealthRecord: jest.fn() }));
jest.mock("./settings", () => ({ saveSettings: jest.fn() }));

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

  await expect(undo({ undo: { kind: "explode" } })).rejects.toThrow(/Cannot undo/);
  expect(Object.keys(UNDO).sort()).toEqual(["removeHealthRecord", "removeWeight", "updateSetting"]);
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
