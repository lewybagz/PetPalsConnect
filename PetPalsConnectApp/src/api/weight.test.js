import { describeTrend, BODY_CONDITION, BODY_CONDITION_SOURCE } from "./weight";

/**
 * The trend is the one piece of reasoning this feature does, so it is the one
 * piece with a test. Everything else is a number going to the server and
 * coming back.
 */

const entry = (pounds, daysAgo) => ({
  pounds,
  takenAt: new Date(Date.now() - daysAgo * 864e5).toISOString(),
});

describe("describeTrend", () => {
  it("says nothing from a single point", () => {
    // One number is a fact, not a trend, and inventing one would be the same
    // sin as guessing a life stage from an unknown age.
    expect(describeTrend([entry(22, 0)])).toBeNull();
    expect(describeTrend([])).toBeNull();
    expect(describeTrend()).toBeNull();
  });

  it("reads the series newest-first, the way the server sends it", () => {
    const trend = describeTrend([entry(26, 0), entry(18, 90)]);
    expect(trend.direction).toBe("up");
    expect(trend.change).toBeCloseTo(8);
  });

  it("notices a loss", () => {
    const trend = describeTrend([entry(18, 0), entry(26, 90)]);
    expect(trend.direction).toBe("down");
    expect(trend.change).toBeCloseTo(-8);
  });

  it("treats a scale's wobble as steady rather than a change", () => {
    expect(describeTrend([entry(22.02, 0), entry(22, 90)]).direction).toBe("steady");
  });

  it("describes the change and never prescribes one", () => {
    const trend = describeTrend([entry(30, 0), entry(20, 180)]);
    // A direction and a number. No target, no verdict, no advice.
    expect(Object.keys(trend).sort()).toEqual(["change", "direction", "from", "to"]);
  });
});

describe("the body condition scale", () => {
  it("is the published 1-9 scale and cites where it came from", () => {
    expect(BODY_CONDITION.map((p) => p.score)).toEqual([1, 3, 5, 7, 9]);
    expect(BODY_CONDITION_SOURCE.url).toMatch(/^https:\/\//);
    expect(BODY_CONDITION_SOURCE.name).toMatch(/WSAVA/);
  });

  it("describes what a body looks like and never sets a target", () => {
    /**
     * The rule this whole screen is held to: describe published guidance,
     * never prescribe. "Aim for", "should be" and a target weight are the
     * three ways this would quietly become advice.
     */
    for (const point of BODY_CONDITION) {
      expect(point.body).not.toMatch(/aim for|should be|target|ideal weight is|reduce|diet/i);
    }
  });
});
