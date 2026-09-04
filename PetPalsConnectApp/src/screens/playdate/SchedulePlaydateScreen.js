import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import * as Location from "expo-location";
import { FontAwesome as Icon } from "@expo/vector-icons";

import { useTailwind } from "../../styles/tailwind";
import { useAuthSession } from "../../context/AuthSessionContext";
import DateTimePickerComponent from "../../components/DateTimePickerComponent";
import { fetchUserPreferences } from "../../../services/UserService";
import { createPlaydate, fetchNearbyLocations } from "../../api/playdates";
import { useTokens } from "../../context/AppThemeContext";
import { useToast } from "../../components/ui";

/**
 * Arrange a playdate with another owner's pet.
 *
 * Nothing on this screen worked. The submit built a PascalCase payload
 * (`Date`, `Location`, `Creator`) that Mongoose drops in strict mode, never
 * sent `startTime` - which the schema requires - and named the organiser from
 * the client. The handler took a `token` parameter that the wrapper filled
 * with `dispatch`, and threw away the token it did fetch.
 *
 * The location list came from `navigator.geolocation`, a browser API that does
 * not exist in React Native, so the "Geolocation is not supported" branch ran
 * every time: the list stayed empty and `selectedLocation._id` threw on submit.
 * expo-location is the platform API, and it is already a dependency.
 *
 * Both pickers are read now, too. The time picker's value was collected and
 * then dropped, so a playdate arranged for 4pm was stored at whatever time the
 * date picker carried.
 */
const DEFAULT_RANGE_MILES = 10;

const SchedulePlaydateScreen = ({ route, navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();
  const { profile } = useAuthSession();

  const pet = route?.params?.pet ?? null;
  const myPetId = profile?.pets?.[0]?._id ?? profile?.pets?.[0];

  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [notes, setNotes] = useState("");
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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

  const submit = async () => {
    if (!selectedLocation) {
      toast.show("Choose where you'd like to meet.");
      return;
    }
    if (!myPetId || !pet?._id) {
      toast.show("A playdate needs a pet from each side.");
      return;
    }

    setSubmitting(true);
    try {
      const playdate = await createPlaydate({
        date,
        time,
        locationId: selectedLocation._id,
        petIds: [myPetId, pet._id],
        notes,
      });
      navigation.navigate("PlaydateCreated", { playdate, pet });
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      testID="schedule-playdate"
      style={tailwind("flex-1")}
      contentContainerStyle={tailwind("p-4")}
      keyboardShouldPersistTaps="handled"
    >
      {pet?.photos?.[0] ? (
        <Image
          source={{ uri: pet.photos[0] }}
          style={tailwind("h-24 w-24 rounded-full self-center")}
        />
      ) : null}

      <Text style={tailwind("text-xl font-bold text-center my-4")}>
        Schedule a playdate with {pet?.name ?? "a friend"}
      </Text>

      <Text style={tailwind("text-base font-semibold mb-2")}>
        <Icon name="map-marker" size={16} color={tokens.primary} /> Where
      </Text>

      {loadingLocations ? <ActivityIndicator /> : null}
      {locationError ? (
        <Text testID="location-error" style={tailwind("text-textMuted mb-2")}>
          {locationError}
        </Text>
      ) : null}

      {locations.map((place) => {
        const chosen = selectedLocation?._id === place._id;
        return (
          <TouchableOpacity
            key={place._id}
            testID={`location-${place._id}`}
            onPress={() => setSelectedLocation(place)}
            style={tailwind(
              `border rounded-2xl p-4 mb-2 ${
                chosen ? "border-primary bg-primarySoft" : "border-border"
              }`
            )}
          >
            <Text style={tailwind("text-base font-semibold")}>{place.address}</Text>
            {place.description ? (
              <Text style={tailwind("text-sm text-textMuted")}>{place.description}</Text>
            ) : null}
          </TouchableOpacity>
        );
      })}

      <Text style={tailwind("text-base font-semibold mb-2 mt-4")}>
        <Icon name="calendar" size={16} color={tokens.primary} /> When
      </Text>
      <DateTimePickerComponent mode="date" date={date} onDateChange={setDate} />
      <DateTimePickerComponent mode="time" date={time} onDateChange={setTime} />

      <TextInput
        testID="playdate-notes"
        style={tailwind("border border-border rounded-xl p-3 mt-3 h-24")}
        placeholder="Anything they should know?"
        multiline
        onChangeText={setNotes}
        value={notes}
      />

      <TouchableOpacity
        testID="playdate-submit"
        disabled={submitting}
        onPress={submit}
        style={tailwind(
          `rounded-xl py-3 items-center mt-4 ${
            submitting ? "bg-border" : "bg-primary"
          }`
        )}
      >
        {submitting ? (
          <ActivityIndicator color={tokens.surface} />
        ) : (
          <Text style={tailwind("text-onPrimary font-semibold")}>
            Send playdate request
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

export default SchedulePlaydateScreen;
