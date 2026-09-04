import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";

import {
  EmptyState,
  ListSkeleton,
  Screen,
  Text,
  Toggle,
  useToast,
} from "../../components/ui";
import {
  fetchCategories,
  fetchPreferences,
  savePreferences,
} from "../../api/preferences";
import { useTailwind } from "../../styles/tailwind";

/**
 * What to be told about.
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
 */
const NotificationPreferencesScreen = () => {
  const tailwind = useTailwind();
  const toast = useToast();

  const [categories, setCategories] = useState([]);
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(null);

  const load = useCallback(async () => {
    try {
      const [loadedCategories, loadedPreferences] = await Promise.all([
        fetchCategories(),
        fetchPreferences(),
      ]);
      setCategories(loadedCategories);
      setPreferences(loadedPreferences);
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
        setPreferences(await savePreferences({ [key]: next }));
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
    <View
      key={key}
      style={tailwind("flex-row items-center justify-between py-md")}
    >
      <View style={tailwind("flex-1 pr-lg")}>
        <Text variant="body" tone={disabled ? "faint" : "default"}>
          {label}
        </Text>
        {description ? (
          <Text variant="caption" tone="muted" style={tailwind("mt-xs")}>
            {description}
          </Text>
        ) : null}
      </View>
      <Toggle
        testID={`preference-${key}`}
        accessibilityLabel={label}
        value={preferences[key] !== false}
        disabled={disabled || saving === key}
        onValueChange={() => toggle(key)}
      />
    </View>
  );

  return (
    <Screen testID="notification-preferences">
      <ScrollView showsVerticalScrollIndicator={false}>
        {row({
          key: "pushNotificationsEnabled",
          label: "Push notifications",
          description: "Turn everything off in one place.",
        })}

        <View style={tailwind("border-t border-border my-md")} />

        <Text variant="caption" tone="muted" style={tailwind("mb-sm")}>
          What to be told about
        </Text>

        {categories.map((category) =>
          row({
            key: category.key,
            label: category.label,
            // Off is off: a category switch that looks live while the master
            // switch is off would be a second, contradictory answer.
            disabled: !pushOn,
          })
        )}

        <View style={tailwind("border-t border-border my-md")} />

        {row({
          key: "emailNotificationsEnabled",
          label: "Email",
          description: "Occasional summaries rather than a push.",
        })}
      </ScrollView>
    </Screen>
  );
};

export default NotificationPreferencesScreen;
