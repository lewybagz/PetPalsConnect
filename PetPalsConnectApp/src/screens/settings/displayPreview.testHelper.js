import React from "react";
import { View } from "react-native";

import { Text } from "../../components/ui";
import { useDevicePreferences } from "../../context/DevicePreferencesContext";

/**
 * A stand-in for the parts of the app the display settings claim to change.
 *
 * `DisplaySettingsScreen.test.js` needs to assert that flipping a switch
 * changes something *elsewhere*, and the real Discover screen brings a gesture
 * handler, a network call and a session with it - none of which is what that
 * test is about. This renders the same two things Discover does with these
 * preferences: a `Text` in a role, and the score pill behind
 * `showMatchScore`.
 *
 * Not a mock of Discover. If the deck stops honouring the preference, this file
 * will not notice - which is why the preference is read here through exactly
 * the hook the deck reads it through, so at least the contract is shared.
 */
const DiscoverPreview = () => {
  const { preferences } = useDevicePreferences();

  return (
    <View>
      <Text testID="preview-body">Bo, 3, Beagle</Text>
      {preferences.showMatchScore ? (
        <Text testID="preview-score" variant="caption">
          92% match
        </Text>
      ) : null}
    </View>
  );
};

export default DiscoverPreview;
