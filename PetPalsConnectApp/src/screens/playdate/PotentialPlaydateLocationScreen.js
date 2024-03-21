import React, { useState, useEffect } from "react";
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

const PotentialPlaydateLocationScreen = ({ route }) => {
  const { placeId } = route.params; // Assumed that placeId is passed in navigation
  const [locationDetails, setLocationDetails] = useState(null);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await fetch(
          `http://your-backend-url/api/reviews/location/${placeId}`
        );
        if (!res.ok) {
          throw new Error("Failed to fetch reviews");
        }
        const data = await res.json();
        setReviews(data);
      } catch (error) {
        console.error("Error fetching reviews:", error);
      }
    };

    fetchReviews();
  }, [placeId]);

  useEffect(() => {
    const fetchLocationDetails = async () => {
      try {
        const response = await fetch(
          `http://your-backend-url/api/potential-playdate-locations/${placeId}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch location details");
        }
        const data = await response.json();
        setLocationDetails(data);
      } catch (error) {
        console.error("Error fetching location details:", error);
      }
    };

    fetchLocationDetails();
  }, [placeId]);

  {
    locationDetails && (
      <Button title="Get Directions" onPress={handleOpenDirections} />
    );
  }

  const handleOpenDirections = () => {
    const destination = `${locationDetails.Latitude},${locationDetails.Longitude}`;
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
          <Text style={styles.title}>{locationDetails.Name}</Text>
          <Image source={{ uri: locationDetails.Photo }} style={styles.image} />
          <Text style={styles.address}>{locationDetails.Address}</Text>
          <Text style={styles.description}>{locationDetails.Description}</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  title: {
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
    fontSize: 16,
    marginTop: 10,
  },
  description: {
    fontSize: 14,
    color: "gray",
    marginTop: 10,
  },
  // Add additional styles as needed
});

export default PotentialPlaydateLocationScreen;
