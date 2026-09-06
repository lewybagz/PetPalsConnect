import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import {
  EmptyState,
  ListSkeleton,
  Screen,
  SettingsRow,
  SettingsSection,
  Text,
  TimeField,
  useToast,
} from "../../components/ui";
import {
  DEFAULT_QUIET_HOURS,
  fetchCategories,
  fetchPreferences,
  savePreferences,
  saveQuietHours,
} from "../../api/preferences";
import { useTailwind } from "../../styles/tailwind";

/**
 * What to be told about, and when to stay quiet.
 *
 * This screen held two toggles in component state with
 * `// Update push notification settings in user preferences` where the save
 * belongs, so flipping one changed a local boolean and nothing else - and the
 * API behind it could not have stored the change either: the read passed the
 * whole Express request where a user id goes, and the write used a key the
 * schema does not have, which strict mode drops without complaining.
 *
 * The categories come from the server rather than being listed here, so a
 * switch on this screen always governs a preference the server actually
 * consults.
 *
 * Quiet hours are the piece that was missing entirely. Everything else here
 * answers "do you want to know about this at all", which is the wrong question
 * to have to answer at two in the morning: the only lever for "not right now"
 * was turning a category off and remembering to turn it back on.
 */
const NotificationPreferencesScreen = () => {
  const tailwind = useTailwind();
  const toast = useToast();

  const [categories, setCategories] = useState([]);
  const [preferences, setPreferences] = useState(null);
  const [quietHours, setQuietHours] = useState(DEFAULT_QUIET_HOURS);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(null);

  const load = useCallback(async () => {
    try {
      const [loadedCategories, loaded] = await Promise.all([
        fetchCategories(),
        fetchPreferences(),
      ]);
      setCategories(loadedCategories);
      setPreferences(loaded.notificationPreferences);
      setQuietHours(loaded.quietHours);
      setFailed(false);
    } catch (error) {
      console.warn("[preferences] Could not load:", error.message);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Flips one switch.
   *
   * Optimistic, and rolled back on failure: a toggle that snaps back is
   * honest, and one that stays where it was put while the server disagrees is
   * exactly the lie this screen used to tell.
   */
  const toggle = useCallback(
    async (key) => {
      const next = !preferences?.[key];
      setPreferences((current) => ({ ...current, [key]: next }));
      setSaving(key);

      try {
        const saved = await savePreferences({ [key]: next });
        setPreferences(saved);
      } catch (error) {
        console.warn("[preferences] Could not save:", error.message);
        setPreferences((current) => ({ ...current, [key]: !next }));
        toast.error("Couldn't save that. Try again.");
      } finally {
        setSaving(null);
      }
    },
    [preferences, toast]
  );

  const changeQuietHours = useCallback(
    async (changes) => {
      const previous = quietHours;
      setQuietHours((current) => ({ ...current, ...changes }));
      setSaving("quietHours");

      try {
        setQuietHours(await saveQuietHours(changes));
      } catch (error) {
        console.warn("[preferences] Could not save quiet hours:", error.message);
        setQuietHours(previous);
        toast.error(
          error.response?.data?.message ?? "Couldn't save that. Try again."
        );
      } finally {
        setSaving(null);
      }
    },
    [quietHours, toast]
  );

  if (loading) {
    return (
      <Screen testID="notification-preferences">
        <ListSkeleton count={4} />
      </Screen>
    );
  }

  if (failed || !preferences) {
    return (
      <Screen testID="notification-preferences">
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load your settings"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={load}
        />
      </Screen>
    );
  }

  const pushOn = preferences.pushNotificationsEnabled !== false;

  const row = ({ key, label, description, disabled }) => (
    <SettingsRow
      key={key}
      testID={`preference-${key}`}
      label={label}
      description={description}
      value={preferences[key] !== false}
      disabled={disabled || saving === key}
      onValueChange={() => toggle(key)}
    />
  );

  return (
    <Screen testID="notification-preferences" scroll>
      <Text variant="display" style={tailwind("mb-lg")}>
        Notifications
      </Text>

      <SettingsSection title="Push">
        {row({
          key: "pushNotificationsEnabled",
          label: "Push notifications",
          description: "Turn everything off in one place.",
        })}
      </SettingsSection>

      <SettingsSection
        title="What to be told about"
        footer={pushOn ? undefined : "Push notifications are off, so none of these apply."}
      >
        {categories.map((category) =>
          row({
            key: category.key,
            label: category.label,
            // Off is off: a category switch that looks live while the master
            // switch is off would be a second, contradictory answer.
            disabled: !pushOn,
          })
        )}
      </SettingsSection>

      <SettingsSection
        title="Quiet hours"
        footer="Nothing is lost - a notification raised while you are quiet still appears in your list, it just does not light up your phone."
      >
        <SettingsRow
          testID="quiet-hours-enabled"
          label="Do not disturb"
          description="Hold pushes back between two times each day."
          value={quietHours.enabled}
          disabled={saving === "quietHours"}
          onValueChange={(value) => changeQuietHours({ enabled: value })}
        />

        {quietHours.enabled ? (
          <SettingsRow
            testID="quiet-hours-window"
            label="From"
            // A window that wraps midnight is the one everybody picks, and it
            // is handled: `isQuiet` on the server treats start > end as
            // "tonight into tomorrow" rather than as an empty range.
            description="A window that runs past midnight is fine."
          >
            <View style={tailwind("flex-row items-center")}>
              <View style={tailwind("flex-1")}>
                <TimeField
                  testID="quiet-hours-start"
                  accessibilityLabel="Quiet hours start"
                  value={quietHours.start}
                  disabled={saving === "quietHours"}
                  onChange={(start) => changeQuietHours({ start })}
                />
              </View>
              <Text tone="muted" style={tailwind("mx-md")}>
                to
              </Text>
              <View style={tailwind("flex-1")}>
                <TimeField
                  testID="quiet-hours-end"
                  accessibilityLabel="Quiet hours end"
                  value={quietHours.end}
                  disabled={saving === "quietHours"}
                  onChange={(end) => changeQuietHours({ end })}
                />
              </View>
            </View>
          </SettingsRow>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Email">
        {row({
          key: "emailNotificationsEnabled",
          label: "Email",
          description: "Occasional summaries rather than a push.",
        })}
      </SettingsSection>

      <View style={tailwind("mb-xl")} />
    </Screen>
  );
};

export default NotificationPreferencesScreen;
