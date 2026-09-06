import React, { useCallback, useEffect, useState } from "react";
import { View, Image, ScrollView, Linking, Platform, ActionSheetIOS } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import api from "../../api/axios";
import { fetchPlace } from "../../api/petCare";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { Button, Card, Screen, Skeleton, Text, useToast } from "../../components/ui";

/**
 * One place: a park to meet at, or somewhere to take a pet for care.
 *
 * Reached from the playdate location list and, now, from every card in the
 * care hub - which is what turned a handful of long-standing problems here
 * from cosmetic into load-bearing:
 *
 * - It fetched `/api/playdates/locations/:id`, a second endpoint that returns
 *   the same Location by the same id with none of the enrichment. The one on
 *   `/api/locations/:id` fills in phone, website and opening hours from Google
 *   Place Details on first open, so a vet reached through this screen showed
 *   an address and no way to ring them. That duplicate endpoint is deleted.
 * - Two identical "Get Directions" buttons, one of them left over.
 * - `<Text><LoadingScreen /></Text>` - a component nested inside a Text node.
 * - An `<Image>` rendered whether or not there was a photo, so a place with
 *   none got a blank grey rectangle where the picture would be.
 * - Every request attached an `Authorization` header by hand from
 *   `getStoredToken`, which the shared API client already does - and does
 *   better, since it refreshes and retries on a 401.
 *
 * A place is a phone number and a route to it before it is anything else, so
 * those are the two things this leads with.
 */

/** Google's weekday strings arrive already formatted; they are rendered as given. */
const PotentialPlaydateLocationScreen = ({ route }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();

  // Every caller sends `locationId`, and the endpoint looks the record up by
  // its Mongo `_id` - `placeId` on a Location is the Google place id, a
  // different value entirely. `placeId` stays accepted for older call sites.
  const locationId = route?.params?.locationId ?? route?.params?.placeId;

  const [place, setPlace] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Independently, so a failed review read costs the reviews and not the
      // place - which is the half somebody came here for.
      const [placeData, reviewData] = await Promise.all([
        fetchPlace(locationId).catch(() => null),
        api.get(`/api/reviews/location/${locationId}`).then((r) => r.data, () => []),
      ]);

      if (cancelled) return;
      setPlace(placeData);
      setReviews(Array.isArray(reviewData) ? reviewData : []);
      setFailed(placeData === null);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  const openDirections = useCallback(() => {
    // The schema stores GeoJSON: `geoLocation.coordinates` is [lng, lat].
    // There is no `Latitude`/`Longitude` on a location, so this produced
    // "undefined,undefined" and opened Maps on nothing.
    const [lng, lat] = place?.geoLocation?.coordinates ?? [];
    if (lat == null || lng == null) {
      toast.show("No directions - this place has no coordinates on file.");
      return;
    }

    const destination = `${lat},${lng}`;
    const google = `https://maps.google.com/maps?daddr=${destination}`;
    const apple = `https://maps.apple.com/maps?daddr=${destination}`;
    const open = (url) => Linking.openURL(url).catch(() => toast.error("Couldn't open maps."));

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Open in Apple Maps", "Open in Google Maps"],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) open(apple);
          else if (index === 2) open(google);
        }
      );
      return;
    }
    open(google);
  }, [place, toast]);

  const call = useCallback(() => {
    if (!place?.phone) return;
    Linking.openURL(`tel:${place.phone.replace(/[^0-9+]/g, "")}`).catch(() =>
      toast.error("Couldn't start the call.")
    );
  }, [place, toast]);

  if (loading) {
    return (
      <Screen testID="place-loading">
        <Skeleton width="70%" height={28} />
        <View style={tailwind("mt-md")}>
          <Skeleton width="100%" height={160} rounded="card" />
        </View>
        <View style={tailwind("mt-md")}>
          <Skeleton width="50%" height={16} />
        </View>
      </Screen>
    );
  }

  if (failed || !place) {
    return (
      <Screen testID="place-error">
        <Card>
          <Text weight="600" style={tailwind("mb-xs")}>
            Couldn&apos;t load this place
          </Text>
          <Text tone="muted">It may have been removed. Go back and try another.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <ScrollView
      testID="place-details"
      style={tailwind("flex-1 bg-background")}
      contentContainerStyle={tailwind("p-lg")}
    >
      <Text variant="display">{place.name}</Text>
      <Text tone="muted" style={tailwind("mt-xs mb-md")}>
        {place.address}
      </Text>

      {/* Only when there is one: an `<Image>` with no uri is a grey rectangle
          that reads as a broken picture rather than as no picture. */}
      {place.photo ? (
        <Image
          source={{ uri: place.photo }}
          style={[tailwind("w-full rounded-card mb-md"), { height: 180 }]}
          resizeMode="cover"
        />
      ) : null}

      {place.description ? (
        <Text style={tailwind("mb-md")}>{place.description}</Text>
      ) : null}

      {/* The two things somebody opened a vet's page to do. */}
      <View style={tailwind("mb-md")}>
        {place.phone ? (
          <Button testID="place-call" title={`Call ${place.phone}`} onPress={call} />
        ) : null}
        <Button
          testID="place-directions"
          title="Get directions"
          variant={place.phone ? "secondary" : "primary"}
          onPress={openDirections}
        />
      </View>

      {place.website ? (
        <Card
          testID="place-website"
          style={tailwind("mb-md")}
          onPress={() => Linking.openURL(place.website).catch(() => {})}
          accessibilityLabel={`Open the website for ${place.name}`}
        >
          <View style={tailwind("flex-row items-center justify-between")}>
            <Text tone="primary" weight="600" style={tailwind("flex-1 mr-sm")}>
              Visit website
            </Text>
            <Ionicons name="open-outline" size={16} color={tokens.textMuted} />
          </View>
        </Card>
      ) : null}

      {place.openingHours?.length ? (
        <Card testID="place-hours" style={tailwind("mb-md")}>
          <Text weight="600" style={tailwind("mb-sm")}>
            Opening hours
          </Text>
          {place.openingHours.map((line) => (
            <Text key={line} variant="caption" tone="muted">
              {line}
            </Text>
          ))}
        </Card>
      ) : null}

      {reviews.length > 0 ? (
        <View testID="place-reviews">
          <Text variant="title" style={tailwind("mb-sm mt-md")}>
            Reviews
          </Text>
          {reviews.map((review) => (
            <Card key={review._id} style={tailwind("mb-sm")}>
              <Text>{review.comment}</Text>
            </Card>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
};

export default PotentialPlaydateLocationScreen;
