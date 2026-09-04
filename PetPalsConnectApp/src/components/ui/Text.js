import React from "react";
import { Text as RNText } from "react-native";

import { useTailwind } from "../../styles/tailwind";
import { displayFamily } from "../../styles/fonts";
import { type } from "../../styles/tokens";

/**
 * Text, in six named roles.
 *
 * The app rendered at nine ad-hoc font sizes with 39 of its 43 weight
 * declarations set to `"bold"` - an emphasis level applied so uniformly that it
 * had stopped signalling emphasis. Sizes were literals typed at the point of
 * use, so "the caption size" was not a thing anyone could change.
 *
 * It also had zero control over Dynamic Type. Roughly a third of iOS users run
 * a non-default text size, and a fixed `fontSize` in a fixed-height row breaks
 * at the larger settings. Each role caps its own multiplier rather than
 * switching scaling off: a heading is already large and overflows first, body
 * copy can afford to grow.
 */

const TONES = {
  default: "text-text",
  muted: "text-textMuted",
  faint: "text-textFaint",
  primary: "text-primary",
  danger: "text-danger",
  success: "text-success",
  warning: "text-warning",
  onPrimary: "text-onPrimary",
};

const Text = ({
  children,
  variant = "body",
  tone = "default",
  align,
  weight,
  style,
  ...rest
}) => {
  const tailwind = useTailwind();
  const role = type[variant] ?? type.body;

  // Only the display roles carry the brand face, and only once it has loaded.
  // The family names the weight on Android, so a caller's `weight` override is
  // ignored for those roles rather than producing a synthesised bold.
  const family = displayFamily(variant);

  return (
    <RNText
      maxFontSizeMultiplier={role.maxScale}
      style={[
        tailwind(TONES[tone] ?? TONES.default),
        {
          fontSize: role.fontSize,
          lineHeight: role.lineHeight,
          ...(family
            ? { fontFamily: family }
            : { fontWeight: weight ?? role.fontWeight }),
        },
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
};

export default Text;
