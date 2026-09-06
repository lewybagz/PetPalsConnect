import React, { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import Slider from "@react-native-community/slider";

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
import { useTokens } from "../../context/AppThemeContext";
import { useTailwind } from "../../styles/tailwind";
import { hit } from "../../styles/tokens";
import {
  distanceFromMiles,
  distanceLabel,
  distanceToMiles,
  weightFromPounds,
  weightLabel,
} from "../../utils/units";

/**
 * What is in the deck.
 *
 * The range slider was on the Settings screen with a caption explaining what it
 * did, and nothing else about the deck could be changed at all - so somebody
 * with a chihuahua and somebody with a great dane saw the same candidates, and
 * the only lever either had was distance.
 *
 * Every filter here narrows `reachableCandidates` on the backend, which is the
 * one place blocking, suspension and range already live. It filters rather than
 * scores on purpose: you want the best fit among pets you can actually meet,
 * not whichever pet happens to be nearest.
 *
 * The numbers are stored canonically - miles, pounds, years - and displayed in
 * whatever units the owner reads, because matching compares two pets' numbers
 * and a stored unit would make two pets incomparable if their owners had
 * chosen differently.
 */

const SPECIES_LABELS = {
  dog: "Dogs",
  cat: "Cats",
  rabbit: "Rabbits",
  bird: "Birds",
  other: "Other",
};

const AGE_MAX = 30;
const WEIGHT_MAX = 300;

/** One tappable species chip. Multi-select, so it is a checkbox, not a radio. */
const SpeciesChip = ({ label, selected, onPress, disabled, testID }) => {
  const tailwind = useTailwind();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        tailwind(
          `px-lg mr-sm mb-sm rounded-pill border justify-center ${
            selected ? "bg-primarySoft border-primary" : "bg-surface border-border"
          }`
        ),
        { minHeight: hit.min - 8, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text variant="label" tone={selected ? "primary" : "muted"}>
        {label}
      </Text>
    </Pressable>
  );
};

const DiscoveryPreferencesScreen = () => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();
  const { settings, choices, loading, failed, reload, update } = useSettings();

  const units = settings.units;
  const discovery = settings.discovery ?? {};

  /**
   * A slider has to move while the finger is down, so the five numeric settings
   * are held here and committed when it is lifted. Saving on every frame would
   * be a request per pixel, and `onSlidingComplete` is the event that means
   * "this is the value I chose".
   */
  const stored = {
    playdateRange: settings.playdateRange ?? 25,
    minWeight: discovery.minWeight ?? 0,
    maxWeight: discovery.maxWeight ?? WEIGHT_MAX,
    minAge: discovery.minAge ?? 0,
    maxAge: discovery.maxAge ?? AGE_MAX,
  };

  const [draft, setDraft] = useState(stored);
  const [seededFrom, setSeededFrom] = useState(() => JSON.stringify(stored));
  const [saving, setSaving] = useState(false);

  // Adjusted during render rather than in an effect: the stored values are the
  // source of truth, and this resynchronises the draft when a save comes back
  // or a rollback puts the old value there. An effect would render the stale
  // number once first, which on a slider is a visible jump.
  const storedKey = JSON.stringify(stored);
  if (storedKey !== seededFrom) {
    setSeededFrom(storedKey);
    setDraft(stored);
  }

  const commit = useCallback(
    async (patch) => {
      setSaving(true);
      const result = await update(patch);
      setSaving(false);
      if (!result.ok) toast.error(result.message);
    },
    [update, toast]
  );

  const toggleSpecies = useCallback(
    async (species) => {
      const current = discovery.species ?? [];
      const next = current.includes(species)
        ? current.filter((entry) => entry !== species)
        : [...current, species];
      await commit({ discovery: { species: next } });
    },
    [discovery.species, commit]
  );

  if (loading || !draft) {
    return (
      <Screen testID="discovery-preferences">
        <ListSkeleton count={5} />
      </Screen>
    );
  }

  if (failed) {
    return (
      <Screen testID="discovery-preferences">
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load your discovery settings"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={reload}
        />
      </Screen>
    );
  }

  const species = choices?.species ?? Object.keys(SPECIES_LABELS);
  const selectedSpecies = discovery.species ?? [];

  const slider = ({ testID, value, min, max, step, onSlide, onCommit }) => (
    <Slider
      testID={testID}
      style={{ width: "100%", height: 40 }}
      minimumValue={min}
      maximumValue={max}
      step={step}
      value={value}
      disabled={saving}
      minimumTrackTintColor={tokens.primary}
      maximumTrackTintColor={tokens.border}
      thumbTintColor={tokens.primary}
      onValueChange={onSlide}
      onSlidingComplete={onCommit}
    />
  );

  /** A slider pair for a min/max range, with the two ends read out above it. */
  const rangeRows = ({ key, label, description, unitSuffix, max, step, toDisplay }) => {
    const minKey = `min${key}`;
    const maxKey = `max${key}`;
    const read = (value) =>
      `${Math.round(toDisplay ? toDisplay(value) : value)}${unitSuffix}`;

    return (
      <SettingsRow
        testID={`discovery-${key.toLowerCase()}`}
        label={label}
        description={description}
        detail={
          draft[minKey] === 0 && draft[maxKey] === max
            ? "Any"
            : `${read(draft[minKey])} - ${read(draft[maxKey])}`
        }
      >
        <Text variant="caption" tone="muted" style={tailwind("mb-xs")}>
          Smallest: {read(draft[minKey])}
        </Text>
        {slider({
          testID: `discovery-${minKey}`,
          value: draft[minKey],
          min: 0,
          max,
          step,
          onSlide: (value) =>
            // Clamped as it moves rather than refused on save: a minimum that
            // has passed the maximum matches nothing, and an empty deck looks
            // exactly like a broken one. The server refuses it too.
            setDraft((current) => ({
              ...current,
              [minKey]: Math.min(value, current[maxKey]),
            })),
          onCommit: (value) =>
            commit({
              discovery: { [minKey]: Math.min(value, draft[maxKey]) },
            }),
        })}

        <Text variant="caption" tone="muted" style={tailwind("mb-xs mt-sm")}>
          Largest: {read(draft[maxKey])}
        </Text>
        {slider({
          testID: `discovery-${maxKey}`,
          value: draft[maxKey],
          min: 0,
          max,
          step,
          onSlide: (value) =>
            setDraft((current) => ({
              ...current,
              [maxKey]: Math.max(value, current[minKey]),
            })),
          onCommit: (value) =>
            commit({
              discovery: { [maxKey]: Math.max(value, draft[minKey]) },
            }),
        })}
      </SettingsRow>
    );
  };

  return (
    <Screen testID="discovery-preferences" scroll>
      <Text variant="display" style={tailwind("mb-xs")}>
        Discovery
      </Text>
      <Text variant="body" tone="muted" style={tailwind("mb-xl")}>
        These narrow who appears in your deck. They do not change how pets are
        scored - you get the best fit among pets you can actually meet.
      </Text>

      <SettingsSection title="Units">
        <SettingsRow label="Distance">
          <SegmentedControl
            testID="units-distance"
            accessibilityLabel="Distance units"
            options={(choices?.units?.distance ?? ["mi", "km"]).map((value) => ({
              value,
              label: value === "km" ? "Kilometres" : "Miles",
            }))}
            value={units.distance}
            disabled={saving}
            onChange={(value) => commit({ units: { distance: value } })}
          />
        </SettingsRow>
        <SettingsRow label="Weight">
          <SegmentedControl
            testID="units-weight"
            accessibilityLabel="Weight units"
            options={(choices?.units?.weight ?? ["lb", "kg"]).map((value) => ({
              value,
              label: value === "kg" ? "Kilograms" : "Pounds",
            }))}
            value={units.weight}
            disabled={saving}
            onChange={(value) => commit({ units: { weight: value } })}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="How far"
        footer="A playdate is something you have to travel to, so this is a hard limit rather than a preference."
      >
        <SettingsRow
          testID="discovery-range"
          label="Maximum distance"
          detail={
            draft.playdateRange === 0
              ? "No limit"
              : `${Math.round(
                  distanceFromMiles(draft.playdateRange, units.distance)
                )} ${distanceLabel(units)}`
          }
        >
          {slider({
            testID: "discovery-playdateRange",
            // Shown and stepped in the owner's units; stored in miles.
            value: distanceFromMiles(draft.playdateRange, units.distance),
            min: 0,
            max: units.distance === "km" ? 160 : 100,
            step: 5,
            onSlide: (value) =>
              setDraft((current) => ({
                ...current,
                playdateRange: distanceToMiles(value, units.distance),
              })),
            onCommit: (value) =>
              commit({ playdateRange: distanceToMiles(value, units.distance) }),
          })}
          <Text variant="caption" tone="muted">
            Zero means no limit.
          </Text>
        </SettingsRow>

        <SettingsRow
          testID="discovery-includeUnknownDistance"
          label="Include pets with no location"
          description="Somebody who has not shared a position has no distance. Leaving them out empties the deck early on."
          value={discovery.includeUnknownDistance !== false}
          disabled={saving}
          onValueChange={(value) =>
            commit({ discovery: { includeUnknownDistance: value } })
          }
        />
      </SettingsSection>

      <SettingsSection title="What kind of pet">
        <SettingsRow
          testID="discovery-species"
          label="Species"
          description="Nothing selected means everything."
        >
          <View style={tailwind("flex-row flex-wrap")}>
            {species.map((entry) => (
              <SpeciesChip
                key={entry}
                testID={`discovery-species-${entry}`}
                label={SPECIES_LABELS[entry] ?? entry}
                selected={selectedSpecies.includes(entry)}
                disabled={saving}
                onPress={() => toggleSpecies(entry)}
              />
            ))}
          </View>
        </SettingsRow>

        {rangeRows({
          key: "Weight",
          label: "Size",
          description: "Play styles differ more by size than by breed.",
          unitSuffix: ` ${weightLabel(units)}`,
          max: WEIGHT_MAX,
          step: 5,
          toDisplay: (pounds) => weightFromPounds(pounds, units.weight),
        })}

        {rangeRows({
          key: "Age",
          label: "Age",
          unitSuffix: " yrs",
          max: AGE_MAX,
          step: 1,
        })}
      </SettingsSection>

      <View style={tailwind("mb-xl")} />
    </Screen>
  );
};

export default DiscoveryPreferencesScreen;
