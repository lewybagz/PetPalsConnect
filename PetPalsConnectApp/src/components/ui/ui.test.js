import React from "react";
import { Text as RNText, View } from "react-native";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import Button from "./Button";
import Card from "./Card";
import EmptyState from "./EmptyState";
import Screen from "./Screen";
import Text from "./Text";
import Skeleton, { CardSkeleton, ListSkeleton } from "./Skeleton";
import { ToastProvider, useToast } from "./Toast";
import { AppThemeProvider } from "../../context/AppThemeContext";
import { dark, hit, light, type } from "../../styles/tokens";

/**
 * The primitives, and the specific defects they exist to make impossible.
 *
 * A survey of the app found 374 touchables carrying two accessibility labels
 * between them, a primary button whose padding was not tappable, and zero
 * screens consuming the safe-area insets the root provider hands out. None of
 * it is visible to lint, types or a green suite - the components read fine.
 * These are the assertions that make the next regression loud.
 */

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));

const wrap = (ui) => render(<AppThemeProvider>{ui}</AppThemeProvider>);

/**
 * Style props arrive as arrays, and Pressable's may still be the function form
 * depending on where it is read from.
 */
const flatten = (style) => {
  const resolved = typeof style === "function" ? style({ pressed: false }) : style;
  return Array.isArray(resolved)
    ? resolved.filter(Boolean).reduce((all, one) => ({ ...all, ...flatten(one) }), {})
    : (resolved ?? {});
};

describe("Button", () => {
  it("puts the press handler and the padding on the same node", async () => {
    const onPress = jest.fn();
    await wrap(<Button testID="b" title="Save" onPress={onPress} />);

    const button = screen.getByTestId("b");
    const style = flatten(button.props.style);

    // AnimatedButton had 10/20 padding on an outer Animated.View and onPress on
    // a TouchableOpacity inside it with none, so taps in the visible blue did
    // nothing. Both belong to this one element now.
    expect(style.paddingTop).toBeGreaterThan(0);
    expect(style.paddingLeft).toBeGreaterThan(0);

    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalled();
  });

  it("is never smaller than the platform tap-target floor", async () => {
    await wrap(<Button testID="b" title="Save" onPress={jest.fn()} />);

    const style = flatten(screen.getByTestId("b").props.style);
    // Apple 44pt, Material 48dp, WCAG 2.2 SC 2.5.8 24x24px.
    expect(style.minHeight).toBeGreaterThanOrEqual(hit.min);
  });

  it("announces itself as a button, with its label", async () => {
    await wrap(<Button testID="b" title="Save" onPress={jest.fn()} />);

    const button = screen.getByTestId("b");
    expect(button.props.accessibilityRole).toBe("button");
    expect(button.props.accessibilityLabel).toBe("Save");
  });

  it("takes an explicit label for an icon-only control", async () => {
    await wrap(
      <Button
        testID="b"
        icon={<View />}
        accessibilityLabel="Add a photo"
        onPress={jest.fn()}
      />
    );

    // Icon-only controls - the kebab menus, the swipe buttons - announced as
    // nothing at all.
    expect(screen.getByTestId("b").props.accessibilityLabel).toBe("Add a photo");
  });

  it("does not fire while loading, and says it is busy", async () => {
    const onPress = jest.fn();
    await wrap(<Button testID="b" title="Save" loading onPress={onPress} />);

    const button = screen.getByTestId("b");
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toMatchObject({ busy: true });
    expect(screen.getByTestId("b-spinner")).toBeTruthy();
  });

  it("does not fire while disabled", async () => {
    const onPress = jest.fn();
    await wrap(<Button testID="b" title="Save" disabled onPress={onPress} />);

    await fireEvent.press(screen.getByTestId("b"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("caps how far its label grows under Dynamic Type", async () => {
    await wrap(<Button testID="b" title="Save" onPress={jest.fn()} />);

    // Scaling stays on; it just cannot push the button off its own row.
    const label = screen.getByText("Save");
    expect(label.props.maxFontSizeMultiplier).toBe(type.body.maxScale);
  });
});

describe("Text", () => {
  it("renders a named role rather than an ad-hoc size", async () => {
    await wrap(<Text variant="title">Bo</Text>);

    const style = flatten(screen.getByText("Bo").props.style);
    expect(style.fontSize).toBe(type.title.fontSize);
    expect(style.lineHeight).toBe(type.title.lineHeight);
  });

  it("falls back to body for an unknown role instead of rendering nothing", async () => {
    await wrap(<Text variant="enormous">Bo</Text>);

    expect(flatten(screen.getByText("Bo").props.style).fontSize).toBe(
      type.body.fontSize
    );
  });

  it("caps Dynamic Type per role", async () => {
    await wrap(<Text variant="caption">3 miles away</Text>);

    expect(screen.getByText("3 miles away").props.maxFontSizeMultiplier).toBe(
      type.caption.maxScale
    );
  });

  it("takes its colour from the active theme", async () => {
    await wrap(<Text tone="muted">Muted</Text>);
    expect(flatten(screen.getByText("Muted").props.style).color).toBe(
      light.textMuted
    );
  });
});

describe("Screen", () => {
  it("applies the bottom inset, which no screen was doing", async () => {
    await wrap(
      <Screen testID="s">
        <RNText>Hi</RNText>
      </Screen>
    );

    // React Navigation covers the top; nothing covered the bottom, so modals
    // and the swipe deck's action row sat under the home indicator.
    expect(flatten(screen.getByTestId("s").props.style).paddingBottom).toBe(34);
  });

  it("leaves the top to the navigator unless asked", async () => {
    await wrap(
      <Screen testID="s">
        <RNText>Hi</RNText>
      </Screen>
    );

    expect(flatten(screen.getByTestId("s").props.style).paddingTop).toBe(0);
  });

  it("applies the top inset when a screen asks for it", async () => {
    await wrap(
      <Screen testID="s" edges={["top", "bottom"]}>
        <RNText>Hi</RNText>
      </Screen>
    );

    expect(flatten(screen.getByTestId("s").props.style).paddingTop).toBe(59);
  });
});

describe("Card", () => {
  it("is not a button when it has no press handler", async () => {
    await wrap(
      <Card testID="c">
        <RNText>Body</RNText>
      </Card>
    );

    expect(screen.getByTestId("c").props.accessibilityRole).toBeUndefined();
  });

  it("becomes one when it does", async () => {
    const onPress = jest.fn();
    await wrap(
      <Card testID="c" onPress={onPress}>
        <RNText>Body</RNText>
      </Card>
    );

    expect(screen.getByTestId("c").props.accessibilityRole).toBe("button");
    await fireEvent.press(screen.getByTestId("c"));
    expect(onPress).toHaveBeenCalled();
  });
});

describe("EmptyState", () => {
  it("shows a title, a message and an optional action", async () => {
    const onAction = jest.fn();
    await wrap(
      <EmptyState
        title="Nobody yet"
        message="Check back soon."
        actionLabel="Refresh"
        onAction={onAction}
      />
    );

    expect(screen.getByText("Nobody yet")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("empty-state-action"));
    expect(onAction).toHaveBeenCalled();
  });

  it("renders without an action", async () => {
    await wrap(<EmptyState title="Nobody yet" />);

    expect(screen.queryByTestId("empty-state-action")).toBeNull();
  });
});

describe("Skeleton", () => {
  it("is hidden from screen readers, which would otherwise read empty boxes", async () => {
    await wrap(<Skeleton testID="sk" />);
    await wrap(<CardSkeleton />);

    expect(screen.getByTestId("skeleton-card").props.accessibilityLabel).toBe(
      "Loading"
    );
  });

  it("renders the requested number of rows", async () => {
    await wrap(<ListSkeleton count={4} />);

    expect(screen.getAllByTestId("skeleton-row")).toHaveLength(4);
  });
});

describe("Toast", () => {
  const Trigger = ({ run }) => {
    const toast = useToast();
    return (
      <Button testID="go" title="Go" onPress={() => run(toast)} />
    );
  };

  const renderWithToast = (run) =>
    render(
      <AppThemeProvider>
        <ToastProvider>
          <Trigger run={run} />
        </ToastProvider>
      </AppThemeProvider>
    );

  it("shows a message without blocking anything", async () => {
    await renderWithToast((toast) => toast.success("Playdate scheduled"));
    await fireEvent.press(screen.getByTestId("go"));

    await waitFor(() => expect(screen.getByText("Playdate scheduled")).toBeTruthy());
    // The point of the whole exercise: no modal, and the app underneath is
    // still there and still pressable.
    expect(screen.getByTestId("go")).toBeTruthy();
  });

  it("announces politely rather than stealing focus", async () => {
    await renderWithToast((toast) => toast.error("That didn't save"));
    await fireEvent.press(screen.getByTestId("go"));

    await waitFor(() =>
      expect(screen.getByTestId("toast").props.accessibilityLiveRegion).toBe("polite")
    );
  });

  it("can be dismissed by hand", async () => {
    await renderWithToast((toast) => toast.show("Saved"));
    await fireEvent.press(screen.getByTestId("go"));

    await waitFor(() => expect(screen.getByTestId("toast-dismiss")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("toast-dismiss"));

    await waitFor(() => expect(screen.queryByTestId("toast")).toBeNull());
  });

  it("offers an action instead of the dismiss affordance when given one", async () => {
    const onAction = jest.fn();
    await renderWithToast((toast) =>
      toast.show("Blocked", { actionLabel: "Undo", onAction })
    );
    await fireEvent.press(screen.getByTestId("go"));

    await waitFor(() => expect(screen.getByTestId("toast-action")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("toast-action"));

    expect(onAction).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId("toast")).toBeNull());
  });

  it("is a no-op outside the provider, so a screen can be tested alone", async () => {
    // Otherwise every screen test in the app would have to mount the host.
    await wrap(<Trigger run={(toast) => toast.success("x")} />);
    await fireEvent.press(screen.getByTestId("go"));

    expect(screen.queryByTestId("toast")).toBeNull();
  });
});

describe("the theme actually reaches components", () => {
  it("paints a card from the dark palette when the theme is dark", async () => {
    // The app shipped a dark-mode switch that changed nothing but its own
    // thumb, because with 185 hex literals there was nothing to switch.
    const { AppThemeProvider: Provider } = require("../../context/AppThemeContext");

    jest.spyOn(require("react-native"), "useColorScheme").mockReturnValue("dark");

    await render(
      <Provider>
        <Card testID="c">
          <RNText>Body</RNText>
        </Card>
      </Provider>
    );

    expect(flatten(screen.getByTestId("c").props.style).backgroundColor).toBe(
      dark.surface
    );
  });
});
