import React, { useState, useEffect, useMemo } from "react";
import {
  Text,
  Image,
  StyleSheet,
  ScrollView,
  FlatList,
  View,
  Linking,
  Button,
  Platform,
  ActionSheetIOS,
} from "react-native";
import LoadingScreen from "../../components/LoadingScreenComponent";
import api from "../../api/axios";
import { getStoredToken } from "../../../utils/tokenutil";
import { useTokens } from "../../context/AppThemeContext";
import { useToast } from "../../components/ui";

const PotentialPlaydateLocationScreen = ({ route }) => {
  const tokens = useTokens();
  const toast = useToast();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  // Every caller sends `locationId`, and both endpoints below look the record
  // up by its Mongo `_id` - `placeId` on a Location is the Google place id, a
  // different value entirely. `placeId` stays accepted for older call sites.
  const locationId = route?.params?.locationId ?? route?.params?.placeId;
  const [locationDetails, setLocationDetails] = useState(null);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const token = await getStoredToken(); // Retrieve the token
        const response = await api.get(`/api/reviews/location/${locationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setReviews(response.data);
      } catch (error) {
        console.error("Error fetching reviews:", error);
      }
    };

    fetchReviews();
  }, [locationId]);

  useEffect(() => {
    const fetchLocationDetails = async () => {
      try {
        const token = await getStoredToken(); // Retrieve the token
        const response = await api.get(
          `/api/playdates/locations/${locationId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setLocationDetails(response.data);
      } catch (error) {
        console.error("Error fetching location details:", error);
      }
    };

    fetchLocationDetails();
  }, [locationId]);

  const handleOpenDirections = () => {
    // The schema stores GeoJSON: `geoLocation.coordinates` is [lng, lat].
    // There is no `Latitude`/`Longitude` on a location, so this produced
    // "undefined,undefined" and opened Maps on nothing.
    const [lng, lat] = locationDetails?.geoLocation?.coordinates ?? [];
    if (lat == null || lng == null) {
      toast.show("No directions - this place has no coordinates on file.");
      return;
    }
    const destination = `${lat},${lng}`;
    const googleMapsURL = `http://maps.google.com/maps?daddr=${destination}`;
    const appleMapsURL = `http://maps.apple.com/maps?daddr=${destination}`;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Open in Apple Maps", "Open in Google Maps"],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            Linking.openURL(appleMapsURL).catch((err) =>
              console.error("An error occurred", err)
            );
          } else if (buttonIndex === 2) {
            Linking.openURL(googleMapsURL).catch((err) =>
              console.error("An error occurred", err)
            );
          }
        }
      );
    } else {
      Linking.openURL(googleMapsURL).catch((err) =>
        console.error("An error occurred", err)
      );
    }
  };

  return (
    <ScrollView style={styles.container}>
      {locationDetails ? (
        <>
          <Text style={styles.title}>{locationDetails.address}</Text>
          <Image source={{ uri: locationDetails.photo }} style={styles.image} />
          <Text style={styles.address}>{locationDetails.Address}</Text>
          <Text style={styles.description}>{locationDetails.Description}</Text>
          {/* Was a bare block statement in the function body, so it never
              reached the output - the button simply did not exist. */}
          <Button title="Get Directions" onPress={handleOpenDirections} />
          {reviews.length > 0 && (
            <FlatList
              data={reviews}
              keyExtractor={(item) => item._id} // Assuming each review has a unique _id
              renderItem={({ item }) => (
                <View style={styles.reviewContainer}>
                  <Text style={styles.reviewText}>{item.comment}</Text>
                  {/* Add more details like rating, reviewer name, etc., here */}
                </View>
              )}
            />
          )}{" "}
          {locationDetails && (
            <Button title="Get Directions" onPress={handleOpenDirections} />
          )}
        </>
      ) : (
        <Text>
          <LoadingScreen />
        </Text>
      )}
    </ScrollView>
  );
};

const makeStyles = (t) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  title: {
    color: t.text,
    fontSize: 24,
    fontWeight: "bold",
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: 10,
    marginTop: 10,
  },
  address: {
    color: t.text,
    fontSize: 16,
    marginTop: 10,
  },
  description: {
    fontSize: 14,
    color: t.textMuted,
    marginTop: 10,
  },
  // Add additional styles as needed
});

export default PotentialPlaydateLocationScreen;
