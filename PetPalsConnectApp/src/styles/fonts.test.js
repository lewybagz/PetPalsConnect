import { isLoaded } from "expo-font";

import { DISPLAY_FAMILIES, displayFamily } from "./fonts";
import { type } from "./tokens";

jest.mock("expo-font", () => ({
  isLoaded: jest.fn(() => false),
  useFonts: jest.fn(() => [true, null]),
}));

/**
 * The display face.
 *
 * The app rendered entirely in the system face at nine ad-hoc sizes, with 39 of
 * 43 weight declarations set to `"bold"`. `expo-font` was already a dependency
 * and its config plugin was already registered in `app.json`; nothing ever
 * called it.
 *
 * The rules that matter are the ones that break silently: a family name that is
 * not on the device renders as something arbitrary, and on Android the family
 * name - not `fontWeight` - is what selects a weight.
 */

beforeEach(() => {
  jest.clearAllMocks();
  isLoaded.mockReturnValue(false);
});

describe("displayFamily", () => {
  it("gives nothing back until the face is actually on the device", () => {
    // Naming a family that has not loaded renders an arbitrary substitute.
    expect(displayFamily("display")).toBeUndefined();
  });

  it("names the face once it has loaded", () => {
    isLoaded.mockReturnValue(true);

    expect(displayFamily("display")).toBe("Nunito_800ExtraBold");
    expect(displayFamily("title")).toBe("Nunito_700Bold");
  });

  it("leaves body copy on the system face", () => {
    isLoaded.mockReturnValue(true);

    // What the OS hints best, what Dynamic Type is tuned for, and what a long
    // message thread should be set in.
    expect(displayFamily("body")).toBeUndefined();
    expect(displayFamily("caption")).toBeUndefined();
  });

  it("survives expo-font throwing rather than taking the screen with it", () => {
    isLoaded.mockImplementation(() => {
      throw new Error("not initialised");
    });

    expect(displayFamily("display")).toBeUndefined();
  });

  it("names a weight in the family, because Android ignores fontWeight", () => {
    // `fontFamily: "Nunito", fontWeight: "700"` renders regular on Android.
    for (const family of Object.values(DISPLAY_FAMILIES)) {
      expect(family).toMatch(/_\d{3}[A-Za-z]+$/);
    }
  });

  it("only names roles the token scale actually has", () => {
    for (const role of Object.keys(DISPLAY_FAMILIES)) {
      expect(type[role]).toBeDefined();
    }
  });
});
