import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Image } from "react-native";
import axios from "axios";
import LoadingScreen from "../../components/LoadingScreenComponent";
import { getStoredToken } from "../../../utils/tokenutil";

// Custom hook for fetching media details
const useFetchMediaDetails = (media) => {
  const [mediaDetails, setMediaDetails] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!media || media.length === 0) return;

    const fetchMediaDetails = async () => {
      setLoading(true);
      try {
        const token = await getStoredToken(); // Retrieve the token
        const mediaResponses = await Promise.all(
          media.map((mediaItem) =>
            axios.get(`/api/media/${mediaItem}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
          )
        );
        setMediaDetails(mediaResponses.map((response) => response.data));
      } catch (error) {
        console.error("Error fetching media details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMediaDetails();
  }, [media]);

  return { mediaDetails, loading };
};

const MediaViewScreen = ({ route }) => {
  const { media } = route.params;
  const { mediaDetails, loading } = useFetchMediaDetails(media);

  if (loading) return <LoadingScreen />;
  if (!mediaDetails.length) return <Text>No media available</Text>;

  return (
    <ScrollView>
      {mediaDetails.map((mediaItem, index) => (
        <View key={index}>
          <Image
            source={{ uri: mediaItem.url }}
            style={{ width: "100%", height: 200 }}
          />
        </View>
      ))}
    </ScrollView>
  );
};

export default MediaViewScreen;
