import React, { useCallback, useState } from "react";
import { View } from "react-native";

import {
  EmptyState,
  ListSkeleton,
  Screen,
  SegmentedControl,
  SettingsRow,
  SettingsSection,
  Text,
  useToast,
} from "../../components/ui";
import { useSettings } from "../../context/SettingsContext";
import { useTailwind } from "../../styles/tailwind";

/**
 * Who can reach you, and where you appear.
 *
 * This screen was two switches in `useState` with
 * `// Update location sharing preference in user settings` where the save
 * belongs. Flipping one changed a local boolean and nothing else, and one of
 * the two duplicated a switch on the Settings screen that *did* save - so the
 * app showed two answers to the same question and neither screen was wrong
 * about what it had been told.
 *
 * Every control here now writes through `PATCH /api/users/me/settings`, and
 * every one of them changes an answer the API gives:
 * `settingsEnforcement.test.js` on the backend proves each one, because a
 * setting that is stored but not honoured is the same failure by a slower
 * route - which is exactly how blocking shipped first time round.
 */

const AUDIENCE_LABELS = {
  everyone: "Everyone",
  matches: "Matches",
  friends: "Friends",
  friendsOfFriends: "Friends of friends",
  nobody: "No one",
};

const labelFor = (value) => AUDIENCE_LABELS[value] ?? value;

const optionsFrom = (values = []) =>
  values.map((value) => ({ value, label: labelFor(value) }));

const PrivacySettingsScreen = () => {
  const tailwind = useTailwind();
  const toast = useToast();
  const { settings, choices, loading, failed, reload, update } = useSettings();

  const [saving, setSaving] = useState(null);

  const privacy = settings.privacy ?? {};

  /**
   * Saves one setting.
   *
   * The context moves the control optimistically and puts it back if the
   * server refuses, so a switch that stays where it was put is a switch that
   * saved. The failure message comes from the validator, which names the
   * setting and says why.
   */
  const change = useCallback(
    async (key, value) => {
      setSaving(key);
      const result = await update({ privacy: { [key]: value } });
      setSaving(null);
      if (!result.ok) toast.error(result.message);
    },
    [update, toast]
  );

  if (loading) {
    return (
      <Screen testID="privacy-settings">
        <ListSkeleton count={5} />
      </Screen>
    );
  }

  if (failed) {
    return (
      <Screen testID="privacy-settings">
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load your privacy settings"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={reload}
        />
      </Screen>
    );
  }

  const audiences = optionsFrom(choices?.audiences ?? ["everyone", "matches", "friends"]);
  const requestAudiences = optionsFrom(
    choices?.requestAudiences ?? ["everyone", "friendsOfFriends", "nobody"]
  );

  const picker = ({ key, label, description, options }) => (
    <SettingsRow
      key={key}
      testID={`privacy-${key}`}
      label={label}
      description={description}
      disabled={saving === key}
    >
      <SegmentedControl
        testID={`privacy-${key}-choice`}
        accessibilityLabel={label}
        options={options}
        value={privacy[key]}
        disabled={saving === key}
        onChange={(value) => change(key, value)}
      />
    </SettingsRow>
  );

  return (
    <Screen testID="privacy-settings" scroll>
      <Text variant="display" style={tailwind("mb-xs")}>
        Privacy
      </Text>
      <Text variant="body" tone="muted" style={tailwind("mb-xl")}>
        These take effect immediately, and apply everywhere - the deck, the map,
        search and your inbox.
      </Text>

      <SettingsSection
        title="Who can reach you"
        footer="Someone kept out by one of these is told the account is not available, never that you have restricted them."
      >
        {picker({
          key: "messagesFrom",
          label: "Messages from",
          description: "Who can start a conversation with you.",
          options: audiences,
        })}
        {picker({
          key: "friendRequestsFrom",
          label: "Friend requests from",
          options: requestAudiences,
        })}
        {picker({
          key: "profileVisibility",
          label: "Profile visible to",
          description: "Who can open your profile and see your pets.",
          options: audiences,
        })}
      </SettingsSection>

      <SettingsSection
        title="Where you appear"
        footer="Turning both off does not remove you from a conversation you are already in - use Blocked accounts for that."
      >
        <SettingsRow
          testID="privacy-discoverableInSearch"
          label="Findable by username"
          description="Lets people who know your username search for you."
          value={privacy.discoverableInSearch !== false}
          disabled={saving === "discoverableInSearch"}
          onValueChange={(value) => change("discoverableInSearch", value)}
        />
        <SettingsRow
          testID="privacy-showOnMap"
          label="Show me on the map"
          description="Your matches see roughly where you are. Off keeps you out of it entirely."
          value={privacy.showOnMap !== false}
          disabled={saving === "showOnMap"}
          onValueChange={(value) => change("showOnMap", value)}
        />
        <SettingsRow
          testID="privacy-locationSharing"
          label="Share my location"
          description="Off means no distances are shown for you, and the map has nowhere to put you."
          value={settings.locationSharingEnabled !== false}
          disabled={saving === "locationSharingEnabled"}
          onValueChange={async (value) => {
            setSaving("locationSharingEnabled");
            const result = await update({ locationSharingEnabled: value });
            setSaving(null);
            if (!result.ok) toast.error(result.message);
          }}
        />
      </SettingsSection>

      <View style={tailwind("mb-xl")} />
    </Screen>
  );
};

export default PrivacySettingsScreen;
