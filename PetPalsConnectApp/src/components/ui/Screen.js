import React from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTailwind } from "../../styles/tailwind";
import { space } from "../../styles/tokens";

/**
 * The outermost element of a screen.
 *
 * `App.js` mounts `SafeAreaProvider` correctly and
 * `react-native-safe-area-context` is a dependency, but not one screen called
 * `useSafeAreaInsets()` or rendered a `SafeAreaView`. React Navigation's header
 * covers the top inset by default; nothing covered the bottom, so full-bleed
 * screens, every modal and the swipe deck's action row sat under the home
 * indicator on every gesture-bar device.
 *
 * Applying it here means no screen has to remember. The top inset is left to
 * the navigator unless a screen asks for it, since doubling it leaves a gap
 * under the header.
 */
const Screen = ({
  children,
  scroll = false,
  padded = true,
  edges = ["bottom"],
  background = "bg-bg",
  contentContainerStyle,
  testID,
  ...rest
}) => {
  const tailwind = useTailwind();
  const insets = useSafeAreaInsets();

  /**
   * The inset is *added* to the screen's own padding, not applied beside it.
   *
   * This used to set all four `padding*` keys and sit after the `p-lg` class in
   * the style array, so `paddingLeft: 0` and `paddingRight: 0` won and every
   * screen using it rendered flush against both edges of the phone. Nothing
   * caught it: the style object is correct, the classes are correct, and the
   * two only conflict once React Native flattens them. It took a screenshot.
   */
  const base = padded ? space.lg : 0;
  const inset = {
    paddingTop: base + (edges.includes("top") ? insets.top : 0),
    // A little padding under the last row even where there is no home
    // indicator, so a button never sits flush against the bezel.
    paddingBottom:
      base + (edges.includes("bottom") ? Math.max(insets.bottom, space.sm) : 0),
    paddingLeft: base + (edges.includes("left") ? insets.left : 0),
    paddingRight: base + (edges.includes("right") ? insets.right : 0),
  };

  if (scroll) {
    return (
      <ScrollView
        testID={testID}
        style={tailwind(`flex-1 ${background}`)}
        contentContainerStyle={[inset, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        {...rest}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View
      testID={testID}
      style={[tailwind(`flex-1 ${background}`), inset]}
      {...rest}
    >
      {children}
    </View>
  );
};

export default Screen;
