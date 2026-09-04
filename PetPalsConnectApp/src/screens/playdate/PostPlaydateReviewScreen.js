import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Button,
  ScrollView,
  Alert,
  Image,
  } from "react-native";
import api from "../../api/axios";
import StarRating from "../../components/StarRating";
import PlayDateLocationCard from "../../components/PlaydateLocationCardComponent";
import { getStoredToken } from "../../../utils/tokenutil";
import { setError } from "../../redux/actions";
import { useTokens } from "../../context/AppThemeContext";
import { Toggle } from "../../components/ui";

const PostPlaydateReviewScreen = ({ route, navigation }) => {
  const tokens = useTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const { playdateId, petId } = route.params;
  const { playdate, pet } = route.params;

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewId, setReviewId] = useState(null);
  const [isReviewVisible, setIsReviewVisible] = useState(true);
  const [locationData, setLocationData] = useState(null);
  const getToken = async () => {
    try {
      const token = await getStoredToken();
      return token;
    } catch (err) {
      setError(err.message);
    }
  };
  const getLocationData = async (locationId, token) => {
    try {
      getToken();
      const response = await api.get(`/api/locations/${locationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching location data:", error);
      return null;
    }
  };

  useEffect(() => {
    if (playdate && playdate.locationId) {
      getLocationData(playdate.locationId).then(setLocationData);
    }
  }, [playdate]);


  const handleVisibilityToggle = async (newValue, token) => {
    setIsReviewVisible(newValue);
    if (!reviewId) {
      Alert.alert("Error", "Review ID is not available.");
      return;
    }

    try {
      getToken();
      await api.patch(
        `/api/reviews/${reviewId}/visibility`,
        {
          Visibility: newValue,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      Alert.alert(
        "Visibility Updated",
        "Your review's visibility has been updated successfully."
      );
    } catch (error) {
      console.error("Error updating review visibility:", error);
      Alert.alert("Error", "Failed to update review visibility.");
      setIsReviewVisible(!newValue);
    }
  };

  const getOwnerIdFromPetId = async (petId, token) => {
    try {
      getToken();
      const response = await api.get(`/api/pets/owner/${petId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response && response.data) {
        return response.data.ownerId;
      } else {
        console.error("No owner data found for pet");
        return null;
      }
    } catch (error) {
      console.error("Error fetching owner data:", error);
      return null;
    }
  };

  const handleSubmitReview = async (token) => {
    const ownerId = await getOwnerIdFromPetId(petId);

    if (rating === 0) {
      Alert.alert(
        "Rating Required",
        "Please select a rating for the playdate."
      );
      return;
    }

    const reviewData = {
      Comment: comment,
      Rating: rating,
      RelatedPlaydate: playdateId,
      Reviewer: ownerId,
      Visibility: isReviewVisible,
    };

    try {
      getToken();
      const response = await api.post("/api/reviews", reviewData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      Alert.alert(
        "Review Submitted",
        "Your review has been successfully submitted."
      );
      setReviewId(response.data._id);
      navigation.navigate("Home");
    } catch (error) {
      Alert.alert("Error", "Failed to submit review. Please try again.");
      console.error(error);
    }
  };
  return (
    <ScrollView style={styles.container}>
      {/* Display Pet Information at the top */}
      {pet && (
        <View style={styles.petInfoContainer}>
          <Image source={{ uri: pet.photo }} style={styles.petImage} />
          <View>
            <Text style={styles.petName}>{pet.name}</Text>
            {locationData && (
              <PlayDateLocationCard
                locationData={locationData}
                navigation={navigation}
              />
            )}
            {/* Other pet details if necessary */}
          </View>
        </View>
      )}

      {/* Display Playdate Information */}
      {playdate && (
        <View style={styles.playdateInfoContainer}>
          <Text style={styles.playdateDetail}>Date: {playdate.date}</Text>
          <Text style={styles.playdateDetail}>
            Location: {playdate.location}
          </Text>
          {/* Other playdate details if necessary */}
        </View>
      )}

      <Text style={styles.header}>Playdate Review</Text>
      <Text style={styles.label}>Rate the playdate:</Text>
      <StarRating
        disabled={false}
        maxStars={5}
        rating={rating}
        selectedStar={(newRating) => setRating(newRating)}
        fullStarColor={"gold"}
      />
      <Text style={styles.label}>Your feedback:</Text>
      <TextInput
        style={styles.input}
        placeholder="Your feedback"
        value={comment}
        onChangeText={setComment}
        multiline
      />
      <View style={styles.visibilityContainer}>
        <Text style={styles.label}>Make review public:</Text>
        <Toggle
          onValueChange={handleVisibilityToggle}
          value={isReviewVisible}
        />
      </View>
      <Button title="Submit Review" onPress={handleSubmitReview} />
    </ScrollView>
  );
};

const makeStyles = (t) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  header: {
    color: t.text,
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  label: {
    color: t.text,
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 10,
  },
  input: {
    borderColor: t.textMuted,
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  petInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  petImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  petName: {
    color: t.text,
    fontSize: 20,
    fontWeight: "bold",
    marginLeft: 10,
  },
  petBreed: {
    fontSize: 16,
    color: t.textMuted,
    marginLeft: 10,
  },
  // ... other styles as needed ...
});

export default PostPlaydateReviewScreen;
