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
      trackColor={{ false: tokens.borderStrong, true: tokens.primary }}
      thumbColor={tokens.surface}
      ios_backgroundColor={tokens.borderStrong}
      style={{ opacity: disabled ? 0.5 : 1 }}
    />
  );
};

export default Toggle;
