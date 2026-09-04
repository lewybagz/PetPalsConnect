import {
  DISTANCE_RATIO,
  MAX_ROTATION,
  VELOCITY_THRESHOLD,
  decisionFor,
  rotationFor,
  stampFor,
  stampOpacity,
} from "./swipeDecision";

/**
 * The rules behind the swipe.
 *
 * A test cannot perform a real pan - RTL has no gesture simulator, and the
 * handlers run on the UI thread - so the thresholds live here, in a pure
 * module, where they can be checked directly. The screen's job is then only to
 * wire a gesture to `submit`, which is small enough to read.
 */

const WIDTH = 400; // A phone. The threshold is 100pt at this width.

describe("decisionFor", () => {
  it("a short drag is not a decision", () => {
    expect(decisionFor({ translationX: 40, velocityX: 0, width: WIDTH })).toBeNull();
    expect(decisionFor({ translationX: -40, velocityX: 0, width: WIDTH })).toBeNull();
  });

  it("a drag past a quarter of the screen decides", () => {
    expect(decisionFor({ translationX: 110, velocityX: 0, width: WIDTH })).toBe("like");
    expect(decisionFor({ translationX: -110, velocityX: 0, width: WIDTH })).toBe("pass");
  });

  it("decides exactly at the threshold, not one point past it", () => {
    const exactly = WIDTH * DISTANCE_RATIO;
    expect(decisionFor({ translationX: exactly, velocityX: 0, width: WIDTH })).toBe("like");
    expect(decisionFor({ translationX: exactly - 1, velocityX: 0, width: WIDTH })).toBeNull();
  });

  it("a fast flick decides however far it travelled", () => {
    // The most deliberate gesture on the screen: the thumb leaves the glass
    // early, so judging by distance alone would reject it.
    expect(
      decisionFor({ translationX: 20, velocityX: VELOCITY_THRESHOLD, width: WIDTH })
    ).toBe("like");
    expect(
      decisionFor({ translationX: -20, velocityX: -VELOCITY_THRESHOLD, width: WIDTH })
    ).toBe("pass");
  });

  it("a slow drag under both thresholds springs back", () => {
    expect(
      decisionFor({ translationX: 60, velocityX: 200, width: WIDTH })
    ).toBeNull();
  });

  it("when velocity and displacement disagree, the flick wins", () => {
    // Dragged right, changed their mind, threw it left. What their thumb just
    // did is the left throw.
    expect(
      decisionFor({ translationX: 90, velocityX: -1500, width: WIDTH })
    ).toBe("pass");
    expect(
      decisionFor({ translationX: -90, velocityX: 1500, width: WIDTH })
    ).toBe("like");
  });

  it("a slow drag past the line follows the displacement, not a stray velocity", () => {
    expect(
      decisionFor({ translationX: 150, velocityX: -50, width: WIDTH })
    ).toBe("like");
  });

  it("an unmeasured screen decides nothing", () => {
    // Before layout, width is 0. Dividing by it would make every touch a
    // decision.
    expect(decisionFor({ translationX: 500, velocityX: 5000, width: 0 })).toBeNull();
    expect(decisionFor()).toBeNull();
  });

  it("a perfectly still release is not a decision", () => {
    expect(decisionFor({ translationX: 0, velocityX: 0, width: WIDTH })).toBeNull();
  });

  it("scales with the screen, so a tablet needs a longer drag", () => {
    // 110pt is past the line on a phone and short of it on a 1000pt tablet.
    expect(decisionFor({ translationX: 110, velocityX: 0, width: WIDTH })).toBe("like");
    expect(decisionFor({ translationX: 110, velocityX: 0, width: 1000 })).toBeNull();
  });
});

describe("rotationFor", () => {
  it("does not lean at rest", () => {
    expect(rotationFor(0, WIDTH)).toBe(0);
  });

  it("leans the way the card is going", () => {
    expect(rotationFor(50, WIDTH)).toBeGreaterThan(0);
    expect(rotationFor(-50, WIDTH)).toBeLessThan(0);
  });

  it("never leans further than the maximum, however hard it is thrown", () => {
    expect(rotationFor(WIDTH * 4, WIDTH)).toBe(MAX_ROTATION);
    expect(rotationFor(-WIDTH * 4, WIDTH)).toBe(-MAX_ROTATION);
  });

  it("is already leaning before the decision threshold", () => {
    // The lean is what says the drag is being received; arriving only at the
    // threshold would make the card feel dead for the first quarter.
    expect(Math.abs(rotationFor(WIDTH * DISTANCE_RATIO * 0.5, WIDTH))).toBeGreaterThan(1);
  });

  it("is flat on an unmeasured screen", () => {
    expect(rotationFor(100, 0)).toBe(0);
  });
});

describe("stampOpacity", () => {
  it("is invisible at rest", () => {
    expect(stampOpacity(0, WIDTH)).toBe(0);
  });

  it("reaches full strength exactly at the decision threshold", () => {
    // The stamp arriving is the promise that letting go now will commit.
    expect(stampOpacity(WIDTH * DISTANCE_RATIO, WIDTH)).toBe(1);
    expect(stampOpacity(WIDTH * DISTANCE_RATIO * 0.5, WIDTH)).toBeCloseTo(0.5);
  });

  it("does not go past full", () => {
    expect(stampOpacity(WIDTH * 2, WIDTH)).toBe(1);
  });

  it("is symmetric", () => {
    expect(stampOpacity(-60, WIDTH)).toBe(stampOpacity(60, WIDTH));
  });

  it("is invisible on an unmeasured screen", () => {
    expect(stampOpacity(100, 0)).toBe(0);
  });
});

describe("stampFor", () => {
  it("shows nothing at rest", () => {
    expect(stampFor(0)).toBeNull();
  });

  it("names the direction", () => {
    expect(stampFor(10)).toBe("like");
    expect(stampFor(-10)).toBe("pass");
  });
});

describe("the thresholds agree with each other", () => {
  it("the stamp is solid exactly when a release would commit", () => {
    // If these two ever drift, the card promises one thing and does another.
    const atThreshold = WIDTH * DISTANCE_RATIO;

    expect(stampOpacity(atThreshold, WIDTH)).toBe(1);
    expect(decisionFor({ translationX: atThreshold, velocityX: 0, width: WIDTH })).toBe(
      "like"
    );

    expect(stampOpacity(atThreshold - 1, WIDTH)).toBeLessThan(1);
    expect(
      decisionFor({ translationX: atThreshold - 1, velocityX: 0, width: WIDTH })
    ).toBeNull();
  });

  it("the stamp shown is the decision that would be made", () => {
    for (const translationX of [-300, -120, 120, 300]) {
      expect(stampFor(translationX)).toBe(
        decisionFor({ translationX, velocityX: 0, width: WIDTH })
      );
    }
  });
});
