import React, { useCallback, useEffect, useState } from "react";
import { Image, TextInput, View } from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";

import { useTailwind } from "../../styles/tailwind";
import { useAuthSession } from "../../context/AuthSessionContext";
import DateTimePickerComponent from "../../components/DateTimePickerComponent";
import { fetchUserPreferences } from "../../../services/UserService";
import {
  createPlaydate,
  fetchLocation,
  fetchMatchedPets,
  fetchNearbyLocations,
} from "../../api/playdates";
import { useTokens } from "../../context/AppThemeContext";
import { Button, Card, ListSkeleton, Screen, Text, useToast } from "../../components/ui";
import { radius } from "../../styles/tokens";

/**
 * Arranging a playdate. One screen, both ways in.
 *
 * There were two flows and they did not meet. `PetDetails` came here with a pet
 * and asked for a place; a location card went to `PlaydatePetSelection` ->
 * `SchedulePlaydateDetails` and asked for a pet. The second one could not
 * complete a playdate at all:
 *
 * - it rendered `UserPetCard` over PetMatch rows, which have no `name` or
 *   `photos`, so the list of matches was a column of blank cards;
 * - tapping one called `BottomSheet.show(...)`, a static method
 *   `@gorhom/bottom-sheet` does not have, which throws;
 * - with exactly one pet of your own it toggled a checkbox and went nowhere;
 * - it navigated with `{ petIds }` and the details screen destructured
 *   `{ petId }`, so the payload was `petsInvolved: [undefined]`; and
 * - the other owner's pet was never in the list it sent, so even a corrected
 *   payload would have invited nobody - the server derives participants from
 *   the owners of the pets involved.
 *
 * So the second flow is gone rather than repaired: it was three screens for the
 * same five fields, and the one that worked was the one screen. What it lacked
 * was the two things the other entry point knew - a place chosen in advance,
 * and a way to pick whose pet - so it takes both now and shows only the
 * questions it cannot already answer.
 *
 * Params, all optional:
 *   `pet`        - the pet being invited, as an object (from PetDetails)
 *   `petId`      - the same, by id
 *   `locationId` - a place chosen in advance (from a location card)
 */
const DEFAULT_RANGE_MILES = 10;

/** A stable empty list, so "no pets yet" is not a new array on every render. */
const NO_PETS = [];

/** A selectable row: a chosen one is ringed, not merely tinted. */
const Choice = ({ testID, chosen, onPress, photo, icon, title, subtitle }) => {
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
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={{ width: 48, height: 48, borderRadius: radius.pill }}
        />
      ) : (
        <View
          style={[
            tailwind("bg-surfaceAlt items-center justify-center"),
            { width: 48, height: 48, borderRadius: radius.pill },
          ]}
        >
          <Ionicons name={icon} size={22} color={tokens.textFaint} />
        </View>
      )}

      <View style={tailwind("flex-1 ml-md")}>
        <Text variant="label">{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {chosen ? (
        <Ionicons name="checkmark-circle" size={22} color={tokens.primary} />
      ) : null}
    </Card>
  );
};

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

const SchedulePlaydateScreen = ({ route, navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();
  const { profile } = useAuthSession();

  const params = route?.params ?? {};
  /** A pet handed over by the caller is fixed; there is nothing to ask. */
  const invitedPet = params.pet ?? null;
  const invitedPetId = invitedPet?._id ?? params.petId ?? null;

  // `pets` arrives populated from /api/users/me. `withRequiredPet` guarantees
  // there is at least one, which is why this screen never asks the user to go
  // and add one.
  // `NO_PETS` rather than a fresh `[]`: this is an effect dependency, and a new
  // empty array every render restarts the effect every render.
  const myPets = Array.isArray(profile?.pets) ? profile.pets : NO_PETS;

  const [myPetId, setMyPetId] = useState(null);
  const [theirPet, setTheirPet] = useState(invitedPet);
  const [matches, setMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(!invitedPetId);

  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [notes, setNotes] = useState("");
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Whichever pet is yours by default. Kept in state rather than derived so a
  // second pet can be chosen, and re-derived if the profile arrives late.
  useEffect(() => {
    setMyPetId((current) => current ?? myPets[0]?._id ?? myPets[0] ?? null);
  }, [myPets]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const preferences = await fetchUserPreferences(profile?._id);
        const range = preferences?.playdateRange ?? DEFAULT_RANGE_MILES;

        const { status } = await Location.requestForegroundPermissionsAsync();

        // Without permission we can still list places, just not nearest-first.
        let coords = {};
        if (status === "granted") {
          const position = await Location.getCurrentPositionAsync({});
          coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
        }

        const nearby = await fetchNearbyLocations({ ...coords, range });
        if (cancelled) return;

        setLocations(nearby);
        if (nearby.length === 0) {
          setLocationError("No places found nearby yet.");
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("[playdate] locations:", error.message);
          setLocationError("Could not load places near you.");
        }
      } finally {
        if (!cancelled) setLoadingLocations(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?._id]);

  /**
   * A place chosen before arriving here is fetched by id rather than looked up
   * in the nearby list: a favourite can be well outside the owner's range, and
   * an empty "Where" section under a button that said "Schedule a playdate
   * here" would be a strange thing to show.
   */
  useEffect(() => {
    if (!params.locationId) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const place = await fetchLocation(params.locationId);
        if (cancelled || !place?._id) return;

        setSelectedLocation(place);
      } catch (error) {
        console.warn("[playdate] location:", error.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.locationId]);

  /** Only worth asking when the caller did not already say whose pet. */
  useEffect(() => {
    if (invitedPetId) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const pets = await fetchMatchedPets();
        if (!cancelled) setMatches(pets);
      } catch (error) {
        if (!cancelled) console.warn("[playdate] matches:", error.message);
      } finally {
        if (!cancelled) setLoadingMatches(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [invitedPetId]);

  const theirPetId = theirPet?._id ?? invitedPetId ?? null;

  /**
   * The nearby list, with a place chosen in advance on the front of it.
   *
   * Merged here rather than pushed into `locations`: the two loads race, and
   * prepending to state meant whichever finished second won - usually the
   * nearby fetch, which replaces the array and dropped the chosen place.
   */
  const places =
    selectedLocation && !locations.some((item) => item._id === selectedLocation._id)
      ? [selectedLocation, ...locations]
      : locations;

  const submit = useCallback(async () => {
    if (!theirPetId) {
      toast.show("Choose whose pet you'd like to meet.");
      return;
    }
    if (!selectedLocation) {
      toast.show("Choose where you'd like to meet.");
      return;
    }
    if (!myPetId) {
      toast.show("A playdate needs a pet from each side.");
      return;
    }

    setSubmitting(true);
    try {
      const playdate = await createPlaydate({
        date,
        time,
        locationId: selectedLocation._id,
        petIds: [myPetId, theirPetId],
        notes,
      });
      navigation.navigate("PlaydateCreated", { playdate, pet: theirPet });
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setSubmitting(false);
    }
  }, [
    date,
    myPetId,
    navigation,
    notes,
    selectedLocation,
    theirPet,
    theirPetId,
    time,
    toast,
  ]);

  return (
    <Screen testID="schedule-playdate" scroll>
      {theirPet?.photos?.[0] ? (
        <Image
          source={{ uri: theirPet.photos[0] }}
          style={tailwind("h-24 w-24 rounded-pill self-center mb-md")}
        />
      ) : null}

      <Text variant="title" align="center">
        {theirPet?.name
          ? `Schedule a playdate with ${theirPet.name}`
          : "Schedule a playdate"}
      </Text>

      {/* Whose pet. Skipped entirely when the caller already said. */}
      {invitedPetId ? null : (
        <>
          <SectionHeading icon="paw-outline">Who</SectionHeading>

          {loadingMatches ? (
            <View testID="matches-loading">
              <ListSkeleton count={3} />
            </View>
          ) : matches.length === 0 ? (
            <Text testID="matches-empty" tone="muted">
              No matches yet. Playdates are arranged with pets you have both
              liked, so keep swiping.
            </Text>
          ) : (
            matches.map((pet) => (
              <Choice
                key={pet._id}
                testID={`their-pet-${pet._id}`}
                chosen={theirPetId === pet._id}
                onPress={() => setTheirPet(pet)}
                photo={pet.photos?.[0]}
                icon="paw-outline"
                title={pet.name ?? "A pet"}
                subtitle={pet.breed}
              />
            ))
          )}
        </>
      )}

      {/* Which of yours. One pet needs no question; the server still gets it. */}
      {myPets.length > 1 ? (
        <>
          <SectionHeading icon="heart-outline">Bringing</SectionHeading>
          {myPets.map((pet) => (
            <Choice
              key={pet._id}
              testID={`my-pet-${pet._id}`}
              chosen={myPetId === pet._id}
              onPress={() => setMyPetId(pet._id)}
              photo={pet.photos?.[0]}
              icon="paw-outline"
              title={pet.name ?? "Your pet"}
              subtitle={pet.breed}
            />
          ))}
        </>
      ) : null}

      <SectionHeading icon="location-outline">Where</SectionHeading>

      {loadingLocations ? (
        <View testID="locations-loading">
          <ListSkeleton count={3} />
        </View>
      ) : null}
      {locationError && places.length === 0 ? (
        <Text testID="location-error" tone="muted" style={tailwind("mb-sm")}>
          {locationError}
        </Text>
      ) : null}

      {places.map((place) => (
        <Choice
          key={place._id}
          testID={`location-${place._id}`}
          chosen={selectedLocation?._id === place._id}
          onPress={() => setSelectedLocation(place)}
          icon="location-outline"
          title={place.name ?? place.address}
          subtitle={place.name ? place.address : place.description}
        />
      ))}

      <SectionHeading icon="calendar-outline">When</SectionHeading>
      <DateTimePickerComponent mode="date" date={date} onDateChange={setDate} />
      <DateTimePickerComponent mode="time" date={time} onDateChange={setTime} />

      <SectionHeading icon="create-outline">Anything else</SectionHeading>
      <TextInput
        testID="playdate-notes"
        style={[
          tailwind("border border-border rounded-card p-md h-24 text-text"),
          { textAlignVertical: "top" },
        ]}
        placeholder="Anything they should know?"
        placeholderTextColor={tokens.textFaint}
        multiline
        onChangeText={setNotes}
        value={notes}
      />

      <Button
        testID="playdate-submit"
        title="Send playdate request"
        loading={submitting}
        onPress={submit}
        style={tailwind("mt-lg")}
      />
    </Screen>
  );
};

export default SchedulePlaydateScreen;
