import React, { useCallback } from "react";
import { Alert } from "react-native";
import { getAuth, signOut } from "@react-native-firebase/auth";

import {
  Button,
  Screen,
  SettingsRow,
  SettingsSection,
  Text,
  useToast,
} from "../../components/ui";
import { useAppTheme } from "../../context/AppThemeContext";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useSettings } from "../../context/SettingsContext";
import { useTailwind } from "../../styles/tailwind";
import { resetAllWalkthroughs } from "../../components/walkthrough";
import { distanceFromMiles, distanceLabel } from "../../utils/units";

/**
 * The settings hub.
 *
 * It used to be twenty-one bordered boxes in one flat column, each a
 * `TouchableOpacity` 34pt tall with no chevron and no current value - so
 * "Privacy Settings" and "Sign Out" looked identical, and nothing said what any
 * of them was currently set to. Three of the controls on it also duplicated
 * ones on the screens it linked to, with a different answer: a location switch
 * that saved and a location switch on the Privacy screen that did not, a dark
 * mode switch here and a theme choice nowhere, and a set of notification
 * toggles built from whatever keys happened to be in the cache.
 *
 * This screen no longer holds any setting that has a home of its own. What it
 * holds is the route to each one and the answer it currently gives, which is
 * the thing a settings hub is for.
 */
const SettingsScreen = ({ navigation }) => {
  const tailwind = useTailwind();
  const toast = useToast();
  const auth = getAuth();
  const { preference: themePreference } = useAppTheme();
  const { deleteAccount, profile } = useAuthSession();
  const { settings } = useSettings();

  const units = settings.units;
  const range = settings.playdateRange ?? 0;
  const rangeDetail =
    range === 0
      ? "No limit"
      : `${Math.round(distanceFromMiles(range, units.distance))} ${distanceLabel(units)}`;

  const THEME_LABELS = { system: "System", light: "Light", dark: "Dark" };

  // RootNavigator swaps to the auth stack as soon as Firebase reports a signed
  // out user, so there is no navigation call to make here.
  const handleSignOut = useCallback(() => {
    signOut(auth).catch((error) => toast.error(error.message));
  }, [auth, toast]);

  const replayTour = useCallback(async () => {
    await resetAllWalkthroughs();
    toast.success("The app tour will play again on your next visit.");
  }, [toast]);

  /**
   * In-app account deletion.
   *
   * Apple's App Store guideline 5.1.1(v) requires any app offering account
   * creation to offer account deletion from inside the app, so this is a
   * shipping requirement. Two taps to confirm, because it cannot be undone.
   */
  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Delete your account?",
      "This permanently removes your profile, pets, playdates and messages. It cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Are you sure?",
              "This is permanent. Your username will be released for someone else to use.",
              [
                { text: "Keep my account", style: "cancel" },
                {
                  text: "Delete forever",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await deleteAccount();
                    } catch (error) {
                      toast.error(
                        error.response?.data?.message ??
                          "Something went wrong. Please try again."
                      );
                    }
                  },
                },
              ]
            ),
        },
      ]
    );
  }, [deleteAccount, toast]);

  return (
    <Screen testID="settings" scroll>
      <Text variant="display" style={tailwind("mb-lg")}>
        Settings
      </Text>

      <SettingsSection title="Finding pets">
        <SettingsRow
          testID="settings-discovery"
          icon="paw-outline"
          label="Discovery"
          description="Distance, size, age and species."
          detail={rangeDetail}
          onPress={() => navigation.navigate("DiscoveryPreferences")}
        />
      </SettingsSection>

      <SettingsSection
        title="Privacy and safety"
        footer="Blocking is symmetric: neither of you appears to the other anywhere in the app."
      >
        <SettingsRow
          testID="settings-privacy"
          icon="lock-closed-outline"
          label="Privacy"
          description="Who can message you, find you and see where you are."
          onPress={() => navigation.navigate("PrivacySettings")}
        />
        <SettingsRow
          testID="settings-blocked-accounts"
          icon="hand-left-outline"
          label="Blocked accounts"
          onPress={() => navigation.navigate("BlockedAccounts")}
        />
        <SettingsRow
          testID="settings-security"
          icon="shield-checkmark-outline"
          label="Sign-in and security"
          onPress={() => navigation.navigate("SecuritySettings")}
        />
      </SettingsSection>

      <SettingsSection title="Notifications">
        <SettingsRow
          testID="settings-notifications"
          icon="notifications-outline"
          label="Notifications"
          description="What to be told about, and when to stay quiet."
          onPress={() => navigation.navigate("NotificationPreferences")}
        />
      </SettingsSection>

      <SettingsSection title="Display">
        <SettingsRow
          testID="settings-display"
          icon="color-palette-outline"
          label="Appearance and accessibility"
          description="Theme, text size and motion."
          detail={THEME_LABELS[themePreference] ?? "System"}
          onPress={() => navigation.navigate("DisplaySettings")}
        />
        <SettingsRow
          testID="settings-replay-tour"
          icon="school-outline"
          label="Show the app tour again"
          // The tours play once on a first visit and are then remembered as
          // seen. Without this there is no way back to them, and the person
          // most likely to want one is somebody who skipped it in a hurry.
          description="Replays the guided tour on Home, More and Favourites."
          onPress={replayTour}
        />
      </SettingsSection>

      <SettingsSection title="Account">
        <SettingsRow
          testID="settings-account-information"
          icon="person-outline"
          label="Account information"
          detail={profile?.username ? `@${profile.username}` : undefined}
          onPress={() => navigation.navigate("AccountInformation")}
        />
        <SettingsRow
          testID="settings-subscription"
          icon="star-outline"
          label="Subscription"
          detail={profile?.subscribed ? "Premium" : "Free"}
          onPress={() => navigation.navigate("SubscriptionManagement")}
        />
        <SettingsRow
          testID="settings-payment-methods"
          icon="card-outline"
          label="Payment methods"
          onPress={() => navigation.navigate("PaymentMethods")}
        />
      </SettingsSection>

      <SettingsSection title="About">
        <SettingsRow
          icon="help-circle-outline"
          label="Help and support"
          onPress={() => navigation.navigate("HelpSupport")}
        />
        <SettingsRow
          icon="document-text-outline"
          label="Legal and policies"
          onPress={() => navigation.navigate("LegalPolicies")}
        />
        <SettingsRow
          icon="information-circle-outline"
          label="About PetPalsConnect"
          onPress={() => navigation.navigate("AboutApp")}
        />
      </SettingsSection>

      <Button
        testID="settings-sign-out"
        title="Sign out"
        variant="secondary"
        onPress={handleSignOut}
      />

      {/* Account deletion - required by App Store guideline 5.1.1(v) */}
      <Button
        testID="settings-delete-account"
        title="Delete my account"
        variant="dangerOutline"
        onPress={handleDeleteAccount}
        style={tailwind("mt-md mb-xl")}
      />
    </Screen>
  );
};

export default SettingsScreen;
