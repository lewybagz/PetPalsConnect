import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";

import { useTailwind } from "../../styles/tailwind";
import { useAppTheme, useTokens } from "../../context/AppThemeContext";
import { darkMapStyle } from "../../styles/mapStyle";
import { hit, radius, space } from "../../styles/tokens";
import { Button, Card, EmptyState, Screen, Text, useToast } from "../../components/ui";
import { fetchMapPets, fetchPlaces, importPlaces } from "../../api/maps";

/**
 * Everyone near you, on a map.
 *
 * This screen has never worked. It read `pet.location.lat` off rows from
 * `/api/petmatches/matched-pets` - PetMatch documents, and a pet has no
 * coordinates in the first place - so every marker was undefined twice over. It
 * called its own places fetch with no arguments, so the position and range went
 * as `undefined`. It drove a bottom sheet through `.show()` and
 * `initialSnapIndex`, neither of which the library has, with snap points
 * `[300, 0]`, which must ascend and cannot contain zero. It switched `mapType`
 * to `"night"`, which is not a value react-native-maps accepts. And it started
 * the walkthrough from a second effect on every mount, whether or not anybody
 * asked for it.
 *
 * The sheet is a card now rather than a gesture-driven panel. A map with two
 * kinds of pin needs somewhere to put the tapped one; it does not need a
 * dependency with its own gesture handler for that.
 */

/** Zoomed to roughly a few miles across, which is what "near me" means here. */
const SPAN = { latitudeDelta: 0.08, longitudeDelta: 0.08 };

/**
 * Apple Maps on iOS, Google on Android.
 *
 * `PROVIDER_GOOGLE` on iOS needs the Google SDK *and* a separate iOS API key;
 * Apple Maps needs neither and is the platform default. Forcing Google on both
 * is why the map was blank on iOS even after the key was configured.
 */
const provider = Platform.select({
  android: PROVIDER_GOOGLE,
  default: PROVIDER_DEFAULT,
});

const MapScreen = ({ navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const { isDark } = useAppTheme();
  const toast = useToast();
  const mapRef = useRef(null);

  const [permission, setPermission] = useState("pending");
  const [origin, setOrigin] = useState(null);
  const [pets, setPets] = useState([]);
  const [places, setPlaces] = useState([]);
  const [showPets, setShowPets] = useState(true);
  const [showPlaces, setShowPlaces] = useState(true);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Asks for the position, then loads both layers.
   *
   * A refused permission is not an error state: the server knows where the
   * caller said they were the last time they shared it, so the map still has an
   * origin and still has pins. Only the blue dot goes away.
   */
  const load = useCallback(async () => {
    let coords = null;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermission(status);

      if (status === "granted") {
        const position = await Location.getCurrentPositionAsync({});
        coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
      }
    } catch (error) {
      console.warn("[map] location:", error.message);
      setPermission("error");
    }

    try {
      const [map, nearby] = await Promise.all([
        fetchMapPets(),
        fetchPlaces(
          coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}
        ),
      ]);

      const here = coords ?? map.origin;
      setOrigin(here);
      setPets(map.pets);
      setPlaces(nearby);

      // An empty collection and a broken query look identical on a map, so say
      // which it is rather than showing bare ground.
      if (nearby.length === 0 && here) {
        const result = await importPlaces({
          latitude: here.latitude,
          longitude: here.longitude,
        });
        if (result.configured && result.imported > 0) {
          setPlaces(await fetchPlaces(here));
        }
      }
    } catch (error) {
      console.warn("[map]", error.message);
      toast.error("Could not load the map.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const region = useMemo(
    () =>
      origin
        ? { ...origin, ...SPAN }
        : // Nothing to centre on yet. A world view beats a arbitrary city.
          { latitude: 0, longitude: 0, latitudeDelta: 100, longitudeDelta: 100 },
    [origin]
  );

  const recentre = () => {
    if (origin && mapRef.current) {
      mapRef.current.animateToRegion({ ...origin, ...SPAN }, 400);
    }
  };

  const openSelected = () => {
    if (!selected) return;
    const { kind, id } = selected;
    setSelected(null);

    if (kind === "pet") navigation.navigate("PetDetails", { petId: id });
    else navigation.navigate("PotentialPlaydateLocation", { locationId: id });
  };

  if (loading) {
    return (
      <Screen testID="map-loading">
        <Text tone="muted">Finding what&apos;s near you…</Text>
      </Screen>
    );
  }

  const nothingToShow = pets.length === 0 && places.length === 0;

  return (
    <View testID="map" style={tailwind("flex-1 bg-bg")}>
      <MapView
        ref={mapRef}
        testID="map-view"
        style={StyleSheet.absoluteFill}
        provider={provider}
        initialRegion={region}
        showsUserLocation={permission === "granted"}
        showsMyLocationButton={false}
        // `mapType="night"` is not a thing; a styled Google map is.
        customMapStyle={isDark ? darkMapStyle : []}
        userInterfaceStyle={isDark ? "dark" : "light"}
        onPress={() => setSelected(null)}
      >
        {showPets &&
          pets.map((pet) => (
            <Marker
              key={`pet-${pet._id}`}
              testID={`map-pin-pet-${pet._id}`}
              identifier={`pet-${pet._id}`}
              coordinate={{ latitude: pet.latitude, longitude: pet.longitude }}
              title={pet.name}
              description={pet.breed}
              onPress={() =>
                setSelected({
                  kind: "pet",
                  id: pet._id,
                  title: pet.name,
                  subtitle: pet.breed,
                  distanceMiles: pet.distanceMiles,
                })
              }
            >
              <View style={[styles.pin, { backgroundColor: tokens.primary }]}>
                <Icon name="dog" size={18} color={tokens.onPrimary} />
              </View>
            </Marker>
          ))}

        {showPlaces &&
          places
            .filter((place) => place.geoLocation?.coordinates?.length === 2)
            .map((place) => (
              <Marker
                key={`place-${place._id}`}
                testID={`map-pin-place-${place._id}`}
                identifier={`place-${place._id}`}
                coordinate={{
                  // Stored as GeoJSON, which is [longitude, latitude].
                  latitude: place.geoLocation.coordinates[1],
                  longitude: place.geoLocation.coordinates[0],
                }}
                title={place.name}
                description={place.address}
                onPress={() =>
                  setSelected({
                    kind: "place",
                    id: place._id,
                    title: place.name,
                    subtitle: place.address,
                    distanceMiles: place.distanceMiles,
                  })
                }
              >
                <View style={[styles.pin, { backgroundColor: tokens.success }]}>
                  <Icon name="tree" size={18} color={tokens.onPrimary} />
                </View>
              </Marker>
            ))}
      </MapView>

      {/* Layer switches. Icon-only would announce as nothing, so they carry
          their own labels. */}
      <Screen padded={false} edges={["top"]} background="bg-transparent" pointerEvents="box-none">
        <View style={tailwind("flex-row p-lg")} pointerEvents="box-none">
          <Toggle
            testID="map-toggle-pets"
            tailwind={tailwind}
            active={showPets}
            label="Matches"
            onPress={() => setShowPets((value) => !value)}
          />
          <View style={{ width: space.sm }} />
          <Toggle
            testID="map-toggle-places"
            tailwind={tailwind}
            active={showPlaces}
            label="Places"
            onPress={() => setShowPlaces((value) => !value)}
          />
        </View>
      </Screen>

      {origin ? (
        <Pressable
          testID="map-recentre"
          accessibilityRole="button"
          accessibilityLabel="Centre the map on me"
          onPress={recentre}
          style={[
            tailwind("absolute right-lg bg-surface border border-border items-center justify-center"),
            styles.recentre,
          ]}
        >
          <Icon name="crosshairs-gps" size={22} color={tokens.text} />
        </Pressable>
      ) : null}

      {selected ? (
        <View testID="map-selection" style={[tailwind("absolute left-lg right-lg"), styles.sheet]}>
          <Card>
            <Text variant="title" numberOfLines={1}>
              {selected.title}
            </Text>
            {selected.subtitle ? (
              <Text tone="muted" numberOfLines={2} style={tailwind("mt-xs")}>
                {selected.subtitle}
              </Text>
            ) : null}
            {selected.distanceMiles != null ? (
              <Text variant="caption" tone="faint" style={tailwind("mt-xs")}>
                {selected.distanceMiles < 1
                  ? "Less than a mile away"
                  : `${Math.round(selected.distanceMiles)} miles away`}
              </Text>
            ) : null}

            <Button
              testID="map-open"
              title={selected.kind === "pet" ? "See this pet" : "See this place"}
              onPress={openSelected}
              style={tailwind("mt-lg")}
            />
          </Card>
        </View>
      ) : null}

      {nothingToShow ? (
        <View testID="map-empty" style={[tailwind("absolute left-lg right-lg"), styles.sheet]}>
          <Card>
            <EmptyState
              testID="map-empty-state"
              icon="map-outline"
              title="Nothing here yet"
              message={
                permission === "granted"
                  ? "No matches or meeting places near you. Match with a pet and they'll appear here."
                  : "Sharing your location lets the map show what's near you."
              }
            />
          </Card>
        </View>
      ) : null}
    </View>
  );
};

/** A labelled pill, because an icon-only layer switch announces as nothing. */
const Toggle = ({ tailwind, active, label, onPress, testID }) => (
  <Pressable
    testID={testID}
    accessibilityRole="switch"
    accessibilityState={{ checked: active }}
    accessibilityLabel={`Show ${label.toLowerCase()}`}
    onPress={onPress}
    style={[
      tailwind(
        `rounded-pill px-lg justify-center border ${
          active ? "bg-primary border-primary" : "bg-surface border-border"
        }`
      ),
      { minHeight: hit.min },
    ]}
  >
    <Text variant="label" tone={active ? "onPrimary" : "muted"}>
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  pin: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  recentre: {
    bottom: 180,
    width: hit.min,
    height: hit.min,
    borderRadius: radius.pill,
  },
  sheet: {
    bottom: space.xl,
  },
});

export default MapScreen;
