import React from "react";
import { Switch } from "react-native";

import { useTokens } from "../../context/AppThemeContext";

/**
 * An on/off switch.
 *
 * Six colour literals - `#767577`, `#81b0ff`, `#f5dd4b`, `#f4f3f4` - were
 * copy-pasted into five settings screens, twelve times in total, which is
 * roughly a sixth of all the hardcoded colour in the app. Nobody chose that
 * palette; it is the snippet from React Native's own `Switch` documentation,
 * and the yellow thumb in particular belongs to no other part of this app.
 *
 * A switch is also the one control where "off" has to stay legible: the track
 * carries no label, so its unselected state is the only thing distinguishing a
 * disabled setting from a missing one.
 *
 * The colours are three tokens of their own rather than borrowed ones. Two
 * things went wrong when they were borrowed:
 *
 * - `thumbColor: surface` is white in light and *near-black* in dark, so every
 *   switch in dark mode had a hole punched in it. That shipped.
 * - `success` cannot be the on-track. In dark it is a mint `#6FD08C`, and a
 *   near-white knob sits on it at 1.7:1 - invisible. `switchOn` is darker for
 *   exactly that reason, and `tokens.test.js` asserts all three relationships.
 *
 * `activeThumbColor` is a react-native-web prop, ignored on iOS and Android.
 * Without it the web gallery fell back to react-native-web's own default,
 * Material teal `#009688`, so every screenshot showed a green knob on a blue
 * track that no device would ever render. Setting it makes all three platforms
 * agree - and the gallery stop lying about the app.
 */
const Toggle = ({ value, onValueChange, disabled = false, accessibilityLabel, testID }) => {
  const tokens = useTokens();

  return (
    <Switch
      testID={testID}
      value={Boolean(value)}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: Boolean(value), disabled }}
      trackColor={{ false: tokens.switchOff, true: tokens.switchOn }}
      thumbColor={tokens.switchKnob}
      activeThumbColor={tokens.switchKnob}
      ios_backgroundColor={tokens.switchOff}
      style={{ opacity: disabled ? 0.5 : 1 }}
    />
  );
};

export default Toggle;
