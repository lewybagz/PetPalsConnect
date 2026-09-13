import { useCallback, useEffect, useState } from "react";
import { View, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button, Card, ListSkeleton, Screen, Text, useToast } from "../../components/ui";
import DateTimePickerComponent from "../../components/DateTimePickerComponent";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { useAuthSession } from "../../context/AuthSessionContext";
import { fetchPlaydate, updatePlaydate } from "../../api/playdates";
import { usePlaydatePlaces } from "../../hooks/usePlaydatePlaces";

/**
 * Changing a playdate that already exists.
 *
 * This screen had three separate faults and each one lost data.
 *
 * It opened with `new Date()` in both pickers rather than the playdate's real
 * date and time, so saving an edit to the venue silently moved the meeting to
 * right now. It offered "Choose Location" into a list screen that navigated
 * onward to *scheduling* instead of returning a choice, so a playdate's venue
 * could not be changed at all - and that screen is deleted, because a second
 * location picker is a second thing to keep in step with the first. And it
 * routed through a confirmation screen that posted the whole location object
 * where the server wanted an id.
 *
 * So it loads what is actually scheduled, uses the same picker the scheduling
 * screen uses, and saves directly. Only the organiser gets here; the server
 * checks that too.
 */
const SectionHeading = ({ icon, children }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();

  return (
    <View style={tailwind("flex-row items-center mt-lg mb-sm")}>
      <Ionicons name={icon} size={16} color={tokens.primary} />
      <Text variant="label" style={tailwind("ml-xs")}>
        {children}
      </Text>
    </View>
  );
};

/** A selectable place. Chosen is ringed, not merely tinted. */
const Choice = ({ testID, chosen, onPress, title, subtitle }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();

  return (
    <Card
      testID={testID}
      onPress={onPress}
      accessibilityState={{ selected: chosen }}
      style={[
        tailwind("mb-sm flex-row items-center"),
        chosen ? { borderColor: tokens.primary, borderWidth: 2 } : null,
      ]}
    >
      <View style={tailwind("flex-1")}>
        <Text variant="label">{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {chosen ? <Ionicons name="checkmark-circle" size={22} color={tokens.primary} /> : null}
    </Card>
  );
};

const PlaydateModificationScreen = ({ route, navigation }) => {
  const tailwind = useTailwind();
  const toast = useToast();
  const { profile } = useAuthSession();
  const playdateId = route?.params?.playdateId;

  const [playdate, setPlaydate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Null until the playdate loads, so the pickers are never seeded with today.
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);

  const {
    places,
    loading: loadingPlaces,
    importing,
    error: placesError,
    selected,
    choose,
  } = usePlaydatePlaces({
    profileId: profile?._id,
    // The venue it already has, so the current choice is ringed on arrival
    // even when it sits outside the owner's browse range.
    presetLocationId: playdate?.location?._id ?? null,
  });

  useEffect(() => {
    if (!playdateId) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const found = await fetchPlaydate(playdateId);
        if (cancelled) return;

        setPlaydate(found);
        // What is actually scheduled, not now. Saving used to overwrite the
        // real date with whatever today happened to be.
        const when = found?.startTime ?? found?.date;
        if (when) {
          setDate(new Date(when));
          setTime(new Date(when));
        }
      } catch (error) {
        if (!cancelled) console.warn("[playdate] load:", error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playdateId]);

  const save = useCallback(async () => {
    if (!date || !time) {
      toast.show("Still loading this playdate.");
      return;
    }

    setSaving(true);
    try {
      await updatePlaydate(playdateId, {
        date,
        time,
        // Only when it changed. Sending the same id is harmless but sending
        // nothing is honest about what the edit was.
        locationId:
          selected && selected._id !== playdate?.location?._id ? selected._id : undefined,
      });
      toast.success("Updated - the other owners have been told.");
      navigation.goBack();
    } catch (error) {
      toast.error(error.response?.data?.message ?? "Couldn't save those changes.");
    } finally {
      setSaving(false);
    }
  }, [date, time, selected, playdate, playdateId, navigation, toast]);

  const discard = () => {
    Alert.alert("Discard changes?", "Your edits will not be saved.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => navigation.goBack() },
    ]);
  };

  if (loading) {
    return (
      <Screen testID="playdate-modify">
        <ListSkeleton count={4} />
      </Screen>
    );
  }

  if (!playdate) {
    return (
      <Screen testID="playdate-modify">
        <Card testID="modify-error">
          <Text variant="title">Couldn&apos;t load this playdate</Text>
          <Text tone="muted" style={tailwind("mt-xs")}>
            It may have been cancelled. Go back and try again.
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen testID="playdate-modify" scroll>
      <Text variant="display">Change this playdate</Text>
      <Text tone="muted" style={tailwind("mt-xs")}>
        Everyone invited is told what changed.
      </Text>

      <SectionHeading icon="calendar-outline">When</SectionHeading>
      <DateTimePickerComponent mode="date" date={date} onDateChange={setDate} />
      <DateTimePickerComponent mode="time" date={time} onDateChange={setTime} />

      <SectionHeading icon="location-outline">Where</SectionHeading>

      {loadingPlaces ? (
        <View testID="modify-places-loading">
          <ListSkeleton count={3} />
          {importing ? (
            <Text tone="muted" style={tailwind("mt-sm")}>
              Looking for parks and trails near you…
            </Text>
          ) : null}
        </View>
      ) : null}

      {placesError && places.length === 0 ? (
        <Text testID="modify-places-error" tone="muted" style={tailwind("mb-sm")}>
          {placesError}
        </Text>
      ) : null}

      {places.map((place) => (
        <Choice
          key={place._id}
          testID={`modify-location-${place._id}`}
          chosen={selected?._id === place._id}
          onPress={() => choose(place)}
          title={place.name ?? place.address}
          subtitle={place.name ? place.address : place.description}
        />
      ))}

      <Button
        testID="modify-save"
        title={saving ? "Saving…" : "Save changes"}
        onPress={save}
        disabled={saving}
        style={tailwind("mt-lg")}
      />
      <Button
        testID="modify-cancel"
        title="Discard"
        variant="soft"
        onPress={discard}
        style={tailwind("mt-sm")}
      />
    </Screen>
  );
};

export default PlaydateModificationScreen;
