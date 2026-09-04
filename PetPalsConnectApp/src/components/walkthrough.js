import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Modal, Pressable, useWindowDimensions, View } from "react-native";

import CustomTooltip from "./CustomTooltip";
import { useTokens } from "../context/AppThemeContext";
import { useTailwind } from "../styles/tailwind";
import { radius, space } from "../styles/tokens";
import { readCache, writeCache } from "../services/localCache";

/**
 * The onboarding walkthrough.
 *
 * The tour markup - which steps exist, in what order, saying what - has been in
 * `HomeScreen`, `MoreScreen` and `FavoritesScreen` since the original app, and
 * it is real design work. What was missing was anything to drive it: this file
 * held three inert shims, because `react-native-copilot` 3.x predates the New
 * Architecture.
 *
 * It is built here rather than on a library. The maintained candidates
 * (`react-native-copilot` 3.3.3, `rn-tourguide` 3.3.2) were both last released
 * in 2024, before React Native 0.86, and copilot additionally wants
 * `react-native-svg` - a native dependency whose behaviour on this stack cannot
 * be checked from here, since there is no simulator and neither jest nor the
 * web gallery renders native code. Trading a shim that provably does nothing
 * for a library that might not work is not an improvement.
 *
 * What a tour actually needs is small: measure a target, dim everything else,
 * say a sentence, step. That is a `Modal`, `measureInWindow`, and four
 * rectangles - all of which this app already uses elsewhere, and all of which
 * can be tested and screenshotted.
 *
 * The three exports keep their old names and shapes, so no screen changed.
 */

const WalkthroughContext = createContext(null);

/** How much breathing room the highlight leaves around its target. */
export const HIGHLIGHT_PADDING = space.sm;

/** Roughly how tall the tooltip is, for deciding which side of the target it goes. */
export const TOOLTIP_ALLOWANCE = 180;

/**
 * Every tour in the app, by name.
 *
 * The name is what "seen" is remembered under, so it has to outlive a rename of
 * the component - `Component.name` is the fallback, and a minifier is entitled
 * to change it. It is a table rather than three string literals because the
 * replay control in Settings has to forget *all* of them, and a tour missing
 * from that list is a tour that can never be replayed. `walkthrough.test.js`
 * checks the screens against it.
 */
export const TOURS = {
  home: "home",
  more: "more",
  favorites: "favorites",
};

/** Remembers that a tour has run, so it does not greet somebody every visit. */
export const seenKey = (tourName) => `walkthrough-seen:${tourName}`;

/**
 * Where the tooltip goes, given the highlighted rectangle and the window.
 *
 * Below the target when there is room beneath it, anchored just above it when
 * there is not. A tooltip covering the thing it is describing explains nothing,
 * and one pinned to the bottom of the screen covers a target near the bottom -
 * which is where two of the three tours put their last step.
 *
 * Pure, and exported, because it is the part with arithmetic in it: a jest
 * render has no layout engine, so this is the only way to check that a step at
 * the foot of the screen does not get a tooltip off the bottom of it.
 */
export const tooltipPlacement = (rect, windowHeight) => {
  const sides = { position: "absolute", left: space.lg, right: space.lg };

  // Nothing measured: no highlight to sit beside, so the tooltip takes the
  // bottom of the screen the way a sheet would.
  if (!rect) return { ...sides, bottom: space.xxl };

  const below = rect.y + rect.height + HIGHLIGHT_PADDING;
  if (windowHeight - below >= TOOLTIP_ALLOWANCE) return { ...sides, top: below };

  // Above: the tooltip's bottom edge meets the top of the highlight. Clamped at
  // both ends, because a target can be taller than the room above it - a step
  // wrapping a whole list has no "above" - and a tooltip pushed off the top of
  // the window is worse than one overlapping its target.
  const above = rect.y - HIGHLIGHT_PADDING;
  const ceiling = Math.max(space.lg, windowHeight - TOOLTIP_ALLOWANCE);
  return {
    ...sides,
    bottom: Math.min(ceiling, Math.max(space.lg, windowHeight - above)),
  };
};

/**
 * One step of the tour.
 *
 * Registers itself on mount and renders its children inside a measurable view.
 * `collapsable={false}` is load-bearing: without it Android flattens a view
 * whose only job is layout, and `measureInWindow` then reports zeroes - the
 * highlight lands in the top-left corner with no size.
 *
 * That wrapper is a real node, so it changes layout. It is `style`-able for the
 * one case where that matters: a step wrapping something that fills its parent.
 * `FavoritesScreen` wraps its `FlatList` in a step, and a list inside an
 * auto-height view has no height to scroll in.
 */
export const CopilotStep = ({ text, order, name, style, children }) => {
  const tour = useContext(WalkthroughContext);
  const ref = useRef(null);

  const register = tour?.register;
  useEffect(() => {
    if (!register) return undefined;
    return register({ name, order, text, ref });
  }, [register, name, order, text]);

  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
};

/**
 * Previously wrapped a component so the tour could measure it.
 *
 * `CopilotStep` owns the measuring view now, so this is a pass-through. It
 * stays because three screens import it, and because a component that has been
 * marked walkthroughable reads as intentional at the call site.
 */
export const walkthroughable = (Component) => Component;

const Scrim = ({ style, tokens }) => (
  <View
    pointerEvents="none"
    style={[{ position: "absolute", backgroundColor: tokens.scrim }, style]}
  />
);

/**
 * The dimmed overlay, with a hole cut around the current step's target.
 *
 * Four rectangles rather than a real cut-out: an actual hole needs an SVG mask,
 * and a mask is the only thing `react-native-svg` would have been for.
 */
const Highlight = ({ rect, tokens }) => {
  if (!rect) return null;

  const top = Math.max(0, rect.y - HIGHLIGHT_PADDING);
  const left = Math.max(0, rect.x - HIGHLIGHT_PADDING);
  const width = rect.width + HIGHLIGHT_PADDING * 2;
  const height = rect.height + HIGHLIGHT_PADDING * 2;

  return (
    <>
      <Scrim tokens={tokens} style={{ top: 0, left: 0, right: 0, height: top }} />
      <Scrim
        tokens={tokens}
        style={{ top: top + height, left: 0, right: 0, bottom: 0 }}
      />
      <Scrim tokens={tokens} style={{ top, left: 0, width: left, height }} />
      <Scrim
        tokens={tokens}
        style={{ top, left: left + width, right: 0, height }}
      />

      <View
        testID="walkthrough-highlight"
        pointerEvents="none"
        style={{
          position: "absolute",
          top,
          left,
          width,
          height,
          borderWidth: 2,
          borderColor: tokens.primary,
          borderRadius: radius.control,
        }}
      />
    </>
  );
};

/**
 * Wraps a screen in a tour.
 *
 * Gives it `start` and `copilotEvents`, the two props the screens already
 * expect, and renders the overlay above it.
 *
 * @param {Object} [options]
 * @param {React.ComponentType} [options.tooltipComponent] - what says the text.
 * @param {string} [options.name] - what "seen" is remembered under.
 * @param {boolean} [options.autoStart] - greet a first-time visitor unasked.
 */
export const copilot = (options = {}) => (Component) => {
  const {
    tooltipComponent: Tooltip = CustomTooltip,
    name: tourName,
    autoStart = true,
  } = options;

  const tour =
    tourName ?? Component.displayName ?? Component.name ?? "walkthrough";

  /**
   * @param {Object} props - forwarded to the wrapped screen, except
   *   `walkthroughAutoStart`, which overrides the option for one render. The
   *   gallery is what needs it: an unseen tour opens over the screen it is
   *   describing, so "Home" and "Home, being introduced" have to be two boards
   *   rather than a race with a cache read. It is also the seam a "replay the
   *   tour" control in Settings would use, alongside `resetWalkthrough`.
   */
  const WithWalkthrough = ({ walkthroughAutoStart, ...props }) => {
    const greetOnFirstVisit = walkthroughAutoStart ?? autoStart;
    const tokens = useTokens();
    const tailwind = useTailwind();
    const { height: windowHeight } = useWindowDimensions();

    // State, not a ref: the overlay renders from this list, so React has to
    // know when it changes. Held as a ref first, which the `refs` lint rule
    // caught - reading one during render is exactly the bug where a step
    // registers and the tour never notices.
    const [steps, setSteps] = useState([]);
    const [running, setRunning] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    const [rect, setRect] = useState(null);
    const listeners = useRef(new Map());

    /** Steps in the order their authors gave them, not registration order. */
    const ordered = useMemo(
      () => [...steps].sort((a, b) => a.order - b.order),
      [steps]
    );

    const emit = useCallback((event, payload) => {
      (listeners.current.get(event) ?? []).forEach((handler) => handler(payload));
    }, []);

    // Functional updates only, so `register` is stable - an unstable one would
    // re-run every step's registration effect on every render of the screen.
    const register = useCallback((step) => {
      setSteps((current) => [
        ...current.filter((existing) => existing.name !== step.name),
        step,
      ]);

      return () => {
        setSteps((current) =>
          current.filter((existing) => existing.name !== step.name)
        );
      };
    }, []);

    /**
     * Measures the step's target and shows the highlight there.
     *
     * A step whose target has left the tree - scrolled away, or conditionally
     * rendered to nothing, which two of `FavoritesScreen`'s steps do - measures
     * nothing. Then there is no highlight and the overlay is a plain scrim with
     * the tooltip on it, rather than a zero-sized ring in the top-left corner
     * pointing at a thing that is not there.
     */
    const focus = useCallback(
      (index) => {
        const step = ordered[index];
        const node = step?.ref?.current;

        if (!node?.measureInWindow) {
          setRect(null);
          return;
        }

        node.measureInWindow((x, y, width, height) => {
          setRect(width && height ? { x, y, width, height } : null);
        });
      },
      [ordered]
    );

    const stop = useCallback(() => {
      setRunning(false);
      setRect(null);
      emit("stop");
      // Remembered on the way out, however it ended: somebody who skipped a
      // tour has said something about wanting to see it, and the answer was no.
      return writeCache(seenKey(tour), true);
    }, [emit]);

    const start = useCallback(() => {
      if (ordered.length === 0) return;
      setStepIndex(0);
      setRunning(true);
      emit("start");
      focus(0);
    }, [emit, focus, ordered]);

    const goTo = useCallback(
      (index) => {
        if (index < 0 || index >= ordered.length) {
          stop();
          return;
        }
        setStepIndex(index);
        emit("stepChange", ordered[index]);
        focus(index);
      },
      [emit, focus, ordered, stop]
    );

    // `start` is rebuilt whenever a step registers, and the auto-start effect
    // must not re-run when it does: its cleanup would cancel the pending read
    // and its own guard would then refuse the retry, so the tour would never
    // play. The ref is how the effect reaches the current `start` without
    // depending on it.
    const startRef = useRef(start);
    useEffect(() => {
      startRef.current = start;
    }, [start]);

    // A first-time visitor is greeted; everybody else is left alone. Without
    // this the tour has no trigger at all: all three screens gate `start()` on
    // `route.params.showTutorial`, and nothing in the app has ever passed it.
    const greeted = useRef(false);
    useEffect(() => {
      if (!greetOnFirstVisit || greeted.current || ordered.length === 0) {
        return undefined;
      }
      greeted.current = true;

      let cancelled = false;
      (async () => {
        const seen = await readCache(seenKey(tour), false);
        if (cancelled || seen) return;
        // A frame's grace so the steps have registered and laid out; measuring
        // before that reports zeroes.
        requestAnimationFrame(() => {
          if (!cancelled) startRef.current();
        });
      })();

      return () => {
        cancelled = true;
      };
      // `tour` is closed over from the HOC's arguments, so it cannot change;
      // `greetOnFirstVisit` is read once, on the visit, by the guard above.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ordered.length]);

    const copilotEvents = useMemo(
      () => ({
        on: (event, handler) => {
          listeners.current.set(event, [
            ...(listeners.current.get(event) ?? []),
            handler,
          ]);
        },
        off: (event, handler) => {
          listeners.current.set(
            event,
            (listeners.current.get(event) ?? []).filter((h) => h !== handler)
          );
        },
      }),
      []
    );

    const value = useMemo(() => ({ register }), [register]);

    const currentStep = ordered[stepIndex] ?? null;
    const isLast = stepIndex >= ordered.length - 1;

    return (
      <WalkthroughContext.Provider value={value}>
        <Component {...props} start={start} copilotEvents={copilotEvents} />

        <Modal
          visible={running && Boolean(currentStep)}
          transparent
          animationType="fade"
          onRequestClose={stop}
        >
          {/* Tapping the dimmed area moves on, which is what people try. */}
          <Pressable
            testID="walkthrough-overlay"
            accessibilityLabel="Continue the tour"
            onPress={() => goTo(stepIndex + 1)}
            style={tailwind("flex-1")}
          >
            {rect ? (
              <Highlight rect={rect} tokens={tokens} />
            ) : (
              <View
                pointerEvents="none"
                style={[
                  tailwind("absolute inset-0"),
                  { backgroundColor: tokens.scrim },
                ]}
              />
            )}

            {currentStep ? (
              <View
                testID="walkthrough-tooltip"
                style={tooltipPlacement(rect, windowHeight)}
              >
                <Tooltip
                  currentStep={currentStep}
                  stepNumber={stepIndex + 1}
                  stepCount={ordered.length}
                  handlePrev={stepIndex > 0 ? () => goTo(stepIndex - 1) : null}
                  handleNext={isLast ? null : () => goTo(stepIndex + 1)}
                  handleStop={stop}
                  isLast={isLast}
                />
              </View>
            ) : null}
          </Pressable>
        </Modal>
      </WalkthroughContext.Provider>
    );
  };

  WithWalkthrough.displayName = `withWalkthrough(${
    Component.displayName || Component.name || "Component"
  })`;

  return WithWalkthrough;
};

/** Forgets that a tour has run, so it plays again. For a "replay" control. */
export const resetWalkthrough = (tourName) => writeCache(seenKey(tourName), false);

/** What Settings' "show the app tour again" calls. */
export const resetAllWalkthroughs = () =>
  Promise.all(Object.values(TOURS).map(resetWalkthrough));

export default {
  copilot,
  walkthroughable,
  CopilotStep,
  resetWalkthrough,
  resetAllWalkthroughs,
  TOURS,
};
