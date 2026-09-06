import React from "react";
import { View } from "react-native";

import {
  Screen,
  SegmentedControl,
  SettingsRow,
  SettingsSection,
  Text,
} from "../../components/ui";
import { useAppTheme } from "../../context/AppThemeContext";
import { useDevicePreferences } from "../../context/DevicePreferencesContext";
import { useTailwind } from "../../styles/tailwind";

/**
 * How the app looks and how much it moves.
 *
 * Everything on this screen is device-local, and deliberately so. A theme, a
 * text size and a motion preference are properties of the phone in your hand,
 * not of the account: somebody who runs their tablet light and their phone dark
 * is not confused, and syncing these would put a round trip and a failure mode
 * in front of a switch that has to feel instant.
 *
 * Theme was also a *two*-state switch labelled "Dark Mode", which cannot say
 * "follow the system" - the setting most people actually want, and the one the
 * provider has supported since dark mode became real. Three options, all
 * visible, is the whole fix.
 */
const DisplaySettingsScreen = () => {
  const tailwind = useTailwind();
  const { preference, setPreference } = useAppTheme();
  const { preferences, set, reset } = useDevicePreferences();

  return (
    <Screen testID="display-settings" scroll>
      <Text variant="display" style={tailwind("mb-xs")}>
        Appearance
      </Text>
      <Text variant="body" tone="muted" style={tailwind("mb-xl")}>
        These are saved on this device, so they do not follow you to another
        phone.
      </Text>

      <SettingsSection title="Theme">
        <SettingsRow label="Appearance" description="System follows your phone's setting.">
          <SegmentedControl
            testID="theme-choice"
            accessibilityLabel="Appearance"
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
            value={preference}
            onChange={setPreference}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Accessibility"
        footer="The app already honours your phone's text size and Reduce Motion settings. These are on top of them."
      >
        <SettingsRow
          testID="display-largerText"
          label="Larger text"
          description="Raises the floor on every text size in the app."
          value={preferences.largerText}
          onValueChange={(value) => set("largerText", value)}
        />
        <SettingsRow
          testID="display-reduceMotion"
          label="Reduce motion"
          description="Cards fade instead of flying, and the swipe deck stops springing back."
          value={preferences.reduceMotion}
          onValueChange={(value) => set("reduceMotion", value)}
        />
      </SettingsSection>

      <SettingsSection title="The deck">
        <SettingsRow
          testID="display-showMatchScore"
          label="Show match score"
          description="The percentage on a Discover card. Off is a calmer deck."
          value={preferences.showMatchScore}
          onValueChange={(value) => set("showMatchScore", value)}
        />
      </SettingsSection>

      <SettingsSection title="Reset">
        <SettingsRow
          testID="display-reset"
          label="Reset display settings"
          description="Puts everything on this screen back to its default."
          onPress={reset}
        />
      </SettingsSection>

      <View style={tailwind("mb-xl")} />
    </Screen>
  );
};

export default DisplaySettingsScreen;
