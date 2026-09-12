import { useCallback, useEffect, useMemo, useState } from "react";
import { View, TextInput, Pressable, Linking, ScrollView, Alert } from "react-native";

import {
  Screen,
  Card,
  Text,
  Button,
  ListSkeleton,
  SettingsRow,
  SettingsSection,
  useToast,
} from "../../components/ui";
import DateTimePickerComponent from "../../components/DateTimePickerComponent";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { useUnits } from "../../context/SettingsContext";
import { formatWeight, weightToPounds } from "../../utils/units";
import {
  fetchWeights,
  addWeight,
  removeWeight,
  describeTrend,
  BODY_CONDITION,
  BODY_CONDITION_SOURCE,
} from "../../api/weight";

/**
 * Weight over time, and the published body condition scale beside it.
 *
 * It records what the scales said and shows what the numbers did. It never
 * names a target weight, a calorie figure or a diet - that is a conversation
 * with a vet, and the same rule that keeps `specialNeeds` from selecting a
 * product applies here. What the screen adds is that the scale is visible at
 * all: 37% of dogs are above their ideal weight and only 29% have ever been
 * scored by anybody.
 *
 * The owner types in their own unit and pounds are what is stored, because
 * matching compares two pets' numbers.
 */
const PetWeightScreen = ({ navigation, route }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();
  const units = useUnits();

  const pet = route?.params?.pet ?? null;
  const petId = route?.params?.petId ?? pet?._id;

  const [entries, setEntries] = useState([]);
  const [measured, setMeasured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  const [amount, setAmount] = useState("");
  const [takenAt, setTakenAt] = useState(new Date());
  const [bodyCondition, setBodyCondition] = useState(null);

  useEffect(() => {
    if (!petId) return undefined;
    let cancelled = false;

    fetchWeights(petId)
      .then((data) => {
        if (cancelled) return;
        setEntries(data.entries);
        setMeasured(data.measured);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [petId, version]);

  const reload = useCallback(() => setVersion((n) => n + 1), []);

  const trend = useMemo(() => describeTrend(entries), [entries]);

  const save = async () => {
    const typed = Number(amount);
    if (!(typed > 0)) {
      toast.show("Enter what the scales said.");
      return;
    }

    // Typed in the owner's unit, stored in pounds. One conversion, here.
    const pounds = weightToPounds(typed, units.weight);

    setSaving(true);
    try {
      await addWeight(petId, {
        pounds,
        takenAt: takenAt.toISOString(),
        bodyCondition: bodyCondition ?? undefined,
      });
      toast.success("Weight recorded");
      setAmount("");
      setBodyCondition(null);
      reload();
    } catch (error) {
      toast.error(error.response?.data?.message ?? "Couldn't save that. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = (entry) => {
    Alert.alert("Remove this weigh-in?", formatWeight(entry.pounds, units), [
      { text: "Keep it", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await removeWeight(petId, entry._id);
            reload();
          } catch {
            toast.error("Couldn't remove that. Try again.");
          }
        },
      },
    ]);
  };

  if (!measured && !loading) {
    return (
      <Screen testID="pet-weight">
        <Card testID="weight-not-measured">
          <Text variant="title">Weight isn{String.fromCharCode(8217)}t tracked for this pet</Text>
          <Text tone="muted" style={tailwind("mt-xs")}>
            PetPals records weight for dogs and cats, where size is part of
            matching and the body condition scale applies.
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen testID="pet-weight">
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text variant="display">{pet?.name ? `${pet.name}'s weight` : "Weight"}</Text>
        <Text tone="muted" style={tailwind("mt-xs mb-md")}>
          What the scales said, over time. Your vet is who decides what it means.
        </Text>

        {loading ? (
          <ListSkeleton />
        ) : (
          <>
            {trend ? (
              <Card testID="weight-trend" style={tailwind("mb-md")}>
                <Text variant="caption" tone="faint">
                  SINCE THE FIRST WEIGH-IN
                </Text>
                <Text variant="title" style={tailwind("mt-xs")}>
                  {trend.direction === "steady"
                    ? "About the same"
                    : `${trend.direction === "up" ? "Up" : "Down"} ${formatWeight(
                        Math.abs(trend.change),
                        units
                      )}`}
                </Text>
              </Card>
            ) : null}

            <SettingsSection title="Add a weigh-in">
              <SettingsRow
                label={`Weight in ${units.weight === "kg" ? "kilograms" : "pounds"}`}
              >
                <TextInput
                  testID="weight-amount"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder={units.weight === "kg" ? "e.g. 12.5" : "e.g. 27.5"}
                  placeholderTextColor={tokens.textFaint}
                  style={tailwind("border border-border rounded-card p-md text-text")}
                />
              </SettingsRow>

              <SettingsRow label="Weighed on">
                <View testID="weight-taken">
                  <DateTimePickerComponent mode="date" date={takenAt} onDateChange={setTakenAt} />
                </View>
              </SettingsRow>

              <SettingsRow
                label="Body condition"
                description="Optional. What you can feel, from the published scale below."
              >
                <View style={tailwind("flex-row flex-wrap")}>
                  {BODY_CONDITION.map((point) => (
                    <Pressable
                      key={point.score}
                      testID={`weight-bcs-${point.score}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: bodyCondition === point.score }}
                      accessibilityLabel={`${point.label}, ${point.score} of 9`}
                      onPress={() =>
                        setBodyCondition(bodyCondition === point.score ? null : point.score)
                      }
                      style={tailwind(
                        `mr-xs mb-xs px-md py-sm rounded-card border ${
                          bodyCondition === point.score
                            ? "bg-primary border-primary"
                            : "border-border"
                        }`
                      )}
                    >
                      <Text
                        variant="caption"
                        tone={bodyCondition === point.score ? "onPrimary" : "muted"}
                      >
                        {point.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </SettingsRow>

              <Button
                testID="weight-save"
                title={saving ? "Saving…" : "Record it"}
                onPress={save}
                disabled={saving}
              />
            </SettingsSection>

            {entries.length > 0 ? (
              <SettingsSection title="History" footer="Tap a weigh-in to remove it.">
                {entries.map((entry, index) => (
                  <SettingsRow
                    key={entry._id}
                    testID={`weight-entry-${index}`}
                    label={formatWeight(entry.pounds, units)}
                    description={new Date(entry.takenAt).toLocaleDateString()}
                    onPress={() => confirmRemove(entry)}
                  />
                ))}
              </SettingsSection>
            ) : (
              <Card testID="weight-empty" style={tailwind("mb-md")}>
                <Text tone="muted">
                  No weigh-ins yet. One number is a fact; a few over a year is
                  the thing worth having.
                </Text>
              </Card>
            )}

            {/* The published scale, so an owner can read their own pet against
                it. Descriptions only - no target, and no arrow pointing at a
                score this pet ought to be. */}
            <SettingsSection title="The body condition scale">
              {BODY_CONDITION.map((point) => (
                <View
                  key={point.score}
                  testID={`weight-scale-${point.score}`}
                  style={tailwind("py-sm")}
                >
                  <Text weight="600">
                    {point.label} ({point.score}/9)
                  </Text>
                  <Text variant="caption" tone="muted">
                    {point.body}
                  </Text>
                </View>
              ))}
              <Pressable
                testID="weight-scale-source"
                accessibilityRole="link"
                accessibilityLabel={`Open ${BODY_CONDITION_SOURCE.name}`}
                onPress={() => Linking.openURL(BODY_CONDITION_SOURCE.url).catch(() => {})}
                style={tailwind("py-sm")}
              >
                <Text variant="caption" tone="primary">
                  {BODY_CONDITION_SOURCE.name}
                </Text>
              </Pressable>
            </SettingsSection>
          </>
        )}
      </ScrollView>
    </Screen>
  );
};

export default PetWeightScreen;
