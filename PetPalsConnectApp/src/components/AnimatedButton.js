import React from "react";

import Button from "./ui/Button";

/**
 * Kept only for its callers. Reach for `components/ui/Button` in new code.
 *
 * The original put its 10/20 padding and its background colour on an outer
 * `Animated.View` and `onPress` on a bare `TouchableOpacity` *inside* it, which
 * had no padding of its own. Taps landing anywhere in the visible blue did
 * nothing at all - the real target was the text box, roughly 20pt tall, against
 * Apple's 44pt, Material's 48dp and WCAG 2.2 SC 2.5.8's 24x24. The miss was
 * invisible in review because the button looked the right size.
 *
 * Its press animation also ran from `onTouchStart`/`onTouchEnd` on the wrapper
 * while the press itself was handled by a child - two different nodes in the
 * responder tree, which is why the animation and the action could disagree.
 *
 * Rather than repair that arrangement, this now forwards to the primitive,
 * where the padding, the background, the press and the 44pt floor all belong to
 * one node. The `animationType` and `shape` props are accepted and ignored:
 * removing them would mean editing every caller for an animation nobody asked
 * for, and the primitive has a press state of its own. `textStyle` goes the
 * same way: the variant decides the label colour now, so a caller cannot set
 * one the background fails contrast against.
 */
const AnimatedButton = ({
  text,
  onPress,
  buttonStyle,
  icon,
  isLoading,
  accessibilityLabel,
  testID,
}) => (
  <Button
    testID={testID}
    title={text}
    icon={icon}
    onPress={onPress}
    loading={isLoading}
    // An icon-only button has no title to fall back on for its label.
    accessibilityLabel={accessibilityLabel ?? text}
    fullWidth={false}
    style={buttonStyle}
  />
);

export default AnimatedButton;
