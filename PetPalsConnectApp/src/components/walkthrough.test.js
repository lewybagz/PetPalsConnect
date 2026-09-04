import fs from "node:fs";
import path from "node:path";
import React from "react";
import { Text as RNText, View } from "react-native";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  CopilotStep,
  HIGHLIGHT_PADDING,
  TOOLTIP_ALLOWANCE,
  TOURS,
  copilot,
  resetAllWalkthroughs,
  resetWalkthrough,
  seenKey,
  tooltipPlacement,
  walkthroughable,
} from "./walkthrough";
import { AppThemeProvider } from "../context/AppThemeContext";
import { readCache, writeCache } from "../services/localCache";
import { space } from "../styles/tokens";

/**
 * The onboarding walkthrough.
 *
 * Two halves, tested two ways.
 *
 * The arithmetic - which side of the target the tooltip goes, and how far - is
 * a pure function, because jest has no layout engine and `measureInWindow`
 * resolves to nothing here. A step at the foot of the screen getting a tooltip
 * off the bottom of it is exactly the class of bug this file was written with
 * and is the reason the placement is not inlined in the render.
 *
 * The behaviour - what registers, what plays, what is remembered - is tested by
 * rendering a real tour. Those tests deliberately do not assert on the
 * highlight: with no measurement the overlay falls back to a plain scrim, which
 * is the documented behaviour for an unmeasurable target and happens to be what
 * every step looks like under jest.
 */

const Tourable = walkthroughable(RNText);

const Screen = ({ start }) => {
  // Something for a test to change, so the wrapped screen can be made to
  // re-render on demand.
  const [bumped, setBumped] = React.useState(0);

  return (
  <View>
    <RNText onPress={start}>Replay the tour</RNText>
    <RNText onPress={() => setBumped((n) => n + 1)}>{`Bumped ${bumped}`}</RNText>

    <CopilotStep text="Second thing" order={2} name="second">
      <Tourable>Two</Tourable>
    </CopilotStep>

    {/* Registered second, shown first: the tour reads `order`, not the tree. */}
    <CopilotStep text="First thing" order={1} name="first">
      <Tourable>One</Tourable>
    </CopilotStep>

    <CopilotStep text="Third thing" order={3} name="third">
      <Tourable>Three</Tourable>
    </CopilotStep>
  </View>
  );
};

const mount = (options = {}) => {
  const Toured = copilot({ name: "test-tour", ...options })(Screen);
  return render(
    <AppThemeProvider>
      <Toured />
    </AppThemeProvider>
  );
};

/** The auto-start waits on a cache read and then a frame. */
const settle = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("where the tooltip goes", () => {
  const windowHeight = 844;

  it("sits below the target when there is room under it", () => {
    const rect = { x: 20, y: 100, width: 200, height: 60 };

    const placement = tooltipPlacement(rect, windowHeight);

    expect(placement.top).toBe(100 + 60 + HIGHLIGHT_PADDING);
    expect(placement.bottom).toBeUndefined();
  });

  it("flips above a target near the foot of the screen", () => {
    // 60pt of room underneath, and the tooltip needs TOOLTIP_ALLOWANCE.
    const rect = { x: 20, y: 700, width: 200, height: 76 };

    const placement = tooltipPlacement(rect, windowHeight);

    expect(placement.top).toBeUndefined();
    // Its bottom edge meets the top of the highlight, so it never covers the
    // thing it is describing.
    expect(placement.bottom).toBe(windowHeight - (700 - HIGHLIGHT_PADDING));
  });

  it("switches sides exactly where the allowance runs out", () => {
    const height = 40;
    const y = windowHeight - TOOLTIP_ALLOWANCE - height - HIGHLIGHT_PADDING;

    expect(tooltipPlacement({ x: 0, y, width: 10, height }, windowHeight).top).toBe(
      windowHeight - TOOLTIP_ALLOWANCE
    );
    expect(
      tooltipPlacement({ x: 0, y: y + 1, width: 10, height }, windowHeight).bottom
    ).toBeDefined();
  });

  it("keeps a tooltip on screen when the target leaves no room on either side", () => {
    // A step wrapping a whole list fills the window: no room below it and none
    // above it either. The clamp is the only thing that keeps the tooltip in
    // the window at all - overlapping the target beats being off the top of it.
    const placement = tooltipPlacement(
      { x: 0, y: 0, width: 390, height: windowHeight },
      windowHeight
    );

    expect(placement.bottom).toBe(windowHeight - TOOLTIP_ALLOWANCE);
    expect(placement.bottom).toBeGreaterThanOrEqual(space.lg);
  });

  it("does not push the tooltip off the top of a short window", () => {
    // A landscape phone is shorter than the allowance the tooltip asks for.
    const shortWindow = 120;

    const placement = tooltipPlacement(
      { x: 0, y: 0, width: 390, height: shortWindow },
      shortWindow
    );

    expect(placement.bottom).toBe(space.lg);
  });

  it("takes the bottom of the screen when nothing could be measured", () => {
    const placement = tooltipPlacement(null, windowHeight);

    expect(placement.bottom).toBe(space.xxl);
    expect(placement.top).toBeUndefined();
  });
});

describe("the tour", () => {
  it("greets a first-time visitor without being asked", async () => {
    await mount();
    await settle();

    expect(await screen.findByText("First thing")).toBeTruthy();
  });

  it("plays the steps in the order their authors gave them", async () => {
    await mount();
    await settle();

    // "second" registers before "first" in the tree; `order` decides.
    expect(await screen.findByText("First thing")).toBeTruthy();
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
  });

  it("advances on Next and finishes on the last step", async () => {
    await mount();
    await settle();
    await screen.findByText("First thing");

    await fireEvent.press(screen.getByTestId("walkthrough-next"));
    expect(await screen.findByText("Second thing")).toBeTruthy();
    expect(screen.getByText("Step 2 of 3")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("walkthrough-next"));
    expect(await screen.findByText("Third thing")).toBeTruthy();

    // The last step offers no Next; its one button ends the tour.
    expect(screen.queryByText("Next")).toBeNull();
    await fireEvent.press(screen.getByTestId("walkthrough-next"));

    await waitFor(() => expect(screen.queryByText("Third thing")).toBeNull());
  });

  it("goes back, so a step read too fast is not lost", async () => {
    await mount();
    await settle();
    await screen.findByText("First thing");

    // Nothing to go back to on the first step.
    expect(screen.queryByTestId("walkthrough-prev")).toBeNull();

    await fireEvent.press(screen.getByTestId("walkthrough-next"));
    await screen.findByText("Second thing");

    await fireEvent.press(screen.getByTestId("walkthrough-prev"));
    expect(await screen.findByText("First thing")).toBeTruthy();
  });

  it("advances when the dimmed area is tapped, which is what people try", async () => {
    await mount();
    await settle();
    await screen.findByText("First thing");

    await fireEvent.press(screen.getByTestId("walkthrough-overlay"));

    expect(await screen.findByText("Second thing")).toBeTruthy();
  });

  it("remembers a tour that was skipped, and does not greet again", async () => {
    await mount();
    await settle();
    await screen.findByText("First thing");

    await fireEvent.press(screen.getByTestId("walkthrough-skip"));

    await waitFor(() => expect(screen.queryByText("First thing")).toBeNull());
    await waitFor(async () =>
      expect(await readCache(seenKey("test-tour"), false)).toBe(true)
    );
  });

  it("remembers a tour that was finished", async () => {
    await mount();
    await settle();
    await screen.findByText("First thing");

    await fireEvent.press(screen.getByTestId("walkthrough-next"));
    await fireEvent.press(screen.getByTestId("walkthrough-next"));
    await fireEvent.press(screen.getByTestId("walkthrough-next"));

    await waitFor(async () =>
      expect(await readCache(seenKey("test-tour"), false)).toBe(true)
    );
  });

  it("leaves a returning visitor alone", async () => {
    await writeCache(seenKey("test-tour"), true);

    await mount();
    await settle();

    // Given a frame and a cache read, and still nothing on screen.
    await waitFor(() => expect(screen.queryByText("First thing")).toBeNull());
  });

  it("still plays when the screen asks for it, seen or not", async () => {
    await writeCache(seenKey("test-tour"), true);

    await mount();
    await settle();
    expect(screen.queryByText("First thing")).toBeNull();

    // `start` is the prop the three tour screens already call from a route
    // param; an explicit request is not a greeting and is not suppressed.
    await fireEvent.press(screen.getByText("Replay the tour"));

    expect(await screen.findByText("First thing")).toBeTruthy();
  });

  it("plays again after a reset, which is what a replay control needs", async () => {
    await writeCache(seenKey("test-tour"), true);
    await resetWalkthrough("test-tour");

    expect(await readCache(seenKey("test-tour"), false)).toBe(false);

    await mount();
    await settle();

    expect(await screen.findByText("First thing")).toBeTruthy();
  });

  it("never greets twice in one visit", async () => {
    await mount();
    await settle();
    await screen.findByText("First thing");

    await fireEvent.press(screen.getByTestId("walkthrough-skip"));
    await waitFor(() => expect(screen.queryByText("First thing")).toBeNull());

    // Re-rendering the wrapped screen re-runs every step's registration effect.
    // The guard is what stops the tour reopening on top of somebody who has
    // just dismissed it.
    await fireEvent.press(screen.getByText("Bumped 0"));
    await settle();

    expect(screen.getByText("Bumped 1")).toBeTruthy();
    expect(screen.queryByText("First thing")).toBeNull();
  });

  it("lets a caller override the greeting for one render", async () => {
    // The gallery renders Home twice - with the tour and without it - and a
    // board cannot wait on a cache read to decide which it got.
    const Toured = copilot({ name: "test-tour" })(Screen);
    await render(
      <AppThemeProvider>
        <Toured walkthroughAutoStart={false} />
      </AppThemeProvider>
    );
    await settle();

    await waitFor(() => expect(screen.queryByText("First thing")).toBeNull());
  });

  it("does not hand the override down to the screen it wraps", async () => {
    // `walkthroughAutoStart` is the HOC's, not the screen's. A screen that
    // spreads its props onto a host component would warn about an unknown one.
    const seen = jest.fn(() => null);
    const Bare = copilot({ name: "test-tour", autoStart: false })(seen);

    await render(
      <AppThemeProvider>
        <Bare walkthroughAutoStart={false} keep="this" />
      </AppThemeProvider>
    );

    expect(seen.mock.calls[0][0]).not.toHaveProperty("walkthroughAutoStart");
    expect(seen.mock.calls[0][0].keep).toBe("this");
  });

  it("does nothing at all when auto-start is switched off", async () => {
    await mount({ autoStart: false });
    await settle();

    await waitFor(() => expect(screen.queryByText("First thing")).toBeNull());

    await fireEvent.press(screen.getByText("Replay the tour"));
    expect(await screen.findByText("First thing")).toBeTruthy();
  });

  it("dims the screen rather than ringing an empty rectangle it could not measure", async () => {
    // Nothing measures under jest, which is the same situation as a step whose
    // target is conditionally rendered to nothing - two of `FavoritesScreen`'s
    // are. The tooltip still has to appear; the ring must not.
    await mount();
    await settle();
    await screen.findByText("First thing");

    expect(screen.getByTestId("walkthrough-tooltip")).toBeTruthy();
    expect(screen.queryByTestId("walkthrough-highlight")).toBeNull();
  });

  it("renders the screen it wraps, tour or no tour", async () => {
    await mount({ autoStart: false });

    expect(screen.getByText("One")).toBeTruthy();
    expect(screen.getByText("Two")).toBeTruthy();
    expect(screen.getByText("Three")).toBeTruthy();
  });
});

/**
 * The replay control in Settings forgets every tour in `TOURS`, so a tour
 * missing from that table is one nobody can ever see a second time - and
 * nothing at runtime would say so. This reads the screens instead.
 */
describe("every tour in the app is in the table", () => {
  const SCREENS = path.join(__dirname, "..", "screens");

  const sourceFiles = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      // `.ts`/`.tsx` as well: a converted screen must not drop out of the check.
      return /\.(js|jsx|ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)
        ? [full]
        : [];
    });

  const toured = sourceFiles(SCREENS)
    .map((file) => ({ file, source: fs.readFileSync(file, "utf8") }))
    .filter(({ source }) => /\bcopilot\(\{/.test(source));

  it("finds the screens that are on a tour", () => {
    // If this drops to zero the rest of the block passes vacuously.
    expect(toured.length).toBeGreaterThanOrEqual(3);
  });

  it.each(toured.map(({ file, source }) => [path.basename(file), source]))(
    "%s names its tour from TOURS",
    (_name, source) => {
      const options = source.match(/\bcopilot\(\{[\s\S]*?\}\)/)[0];
      const named = options.match(/name:\s*TOURS\.(\w+)/);

      expect(named).not.toBeNull();
      expect(Object.keys(TOURS)).toContain(named[1]);
    }
  );

  it("names each tour once, so two screens cannot share a 'seen' flag", () => {
    const used = toured.map(
      ({ source }) => source.match(/name:\s*TOURS\.(\w+)/)[1]
    );

    expect(new Set(used).size).toBe(used.length);
  });

  it("forgets all of them at once, which is what the replay control does", async () => {
    await Promise.all(
      Object.values(TOURS).map((tour) => writeCache(seenKey(tour), true))
    );

    await resetAllWalkthroughs();

    for (const tour of Object.values(TOURS)) {
      expect(await readCache(seenKey(tour), true)).toBe(false);
    }
  });
});
