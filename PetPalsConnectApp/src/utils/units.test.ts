// The suite's globals imported rather than assumed: this is the first test
// written in TypeScript, and `tsconfig` names only `expo/types` - so `describe`
// and `expect` are not in scope for the typechecker the way they are for jest.
// Importing them costs nothing at runtime and keeps `npm run typecheck` at zero
// errors, which is the whole point of the gradual conversion.
import { describe, expect, it } from "@jest/globals";

import {
  DEFAULT_UNITS,
  distanceFromMiles,
  distanceLabel,
  distanceToMiles,
  formatDistance,
  formatWeight,
  weightFromPounds,
  weightLabel,
  weightToPounds,
} from "./units";

/**
 * Units are a display concern, and this file is what keeps them one.
 *
 * Storage stays canonical - miles and pounds - because matching compares two
 * pets' numbers, and a stored unit would make two pets incomparable if their
 * owners had chosen differently. So every conversion happens on the way to a
 * screen or on the way back from an input, and both directions have to round
 * trip or a weight typed in kilograms drifts every time it is edited.
 */

describe("reading a distance", () => {
  it("says miles by default", () => {
    expect(formatDistance(12.4)).toBe("12 mi");
  });

  it("converts for somebody who reads kilometres", () => {
    expect(formatDistance(10, { distance: "km", weight: "lb" })).toBe("16 km");
  });

  it("keeps a decimal below ten and drops it above", () => {
    // 2.4 vs 2.9 miles decides whether you walk. 23 vs 23.4 does not.
    expect(formatDistance(2.44)).toBe("2.4 mi");
    expect(formatDistance(23.4)).toBe("23 mi");
  });

  it("returns null when nobody knows", () => {
    // A real state: somebody who has never shared a position stays in the deck
    // with no distance rather than being dropped from it. "0 miles away" would
    // be a lie, and a strange one.
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(undefined)).toBeNull();
    expect(formatDistance(Number.NaN)).toBeNull();
    expect(formatDistance(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("reading a weight", () => {
  it("says pounds by default and kilograms on request", () => {
    expect(formatWeight(60)).toBe("60 lb");
    expect(formatWeight(60, { distance: "mi", weight: "kg" })).toBe("27 kg");
  });

  it("is null rather than zero for a pet whose weight is missing", () => {
    expect(formatWeight(null)).toBeNull();
  });
});

describe("converting for input and storage", () => {
  it("round trips a weight through the unit the owner typed", () => {
    const typed = 27.2;
    const stored = weightToPounds(typed, "kg");
    expect(weightFromPounds(stored, "kg")).toBeCloseTo(typed, 6);
  });

  it("leaves pounds alone", () => {
    expect(weightToPounds(60, "lb")).toBe(60);
    expect(weightFromPounds(60, "lb")).toBe(60);
  });

  it("round trips a distance the same way", () => {
    const stored = distanceToMiles(40, "km");
    expect(distanceFromMiles(stored, "km")).toBeCloseTo(40, 6);
    expect(distanceToMiles(25, "mi")).toBe(25);
  });
});

describe("labels", () => {
  it("names the unit for a slider's end and a picker's option", () => {
    expect(distanceLabel(DEFAULT_UNITS)).toBe("miles");
    expect(distanceLabel({ distance: "km", weight: "lb" })).toBe("km");
    expect(weightLabel(DEFAULT_UNITS)).toBe("lb");
    expect(weightLabel({ distance: "mi", weight: "kg" })).toBe("kg");
  });
});
