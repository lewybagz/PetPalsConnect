// ScheduledPlaydatesScreen.js
import React, { useState, useEffect, useCallback } from "react";
import {
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import axios from "axios";
import { useTailwind } from "nativewind";
import { useNavigation } from "@react-navigation/native";
import { getStoredToken } from "../../../utils/tokenutil";

const ScheduledPlaydatesScreen = () => {
  const [playdates, setPlaydates] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const tailwind = useTailwind();
  const navigation = useNavigation();

  const fetchPlaydates = async () => {
    try {
      const token = await getStoredToken(); // Retrieve the token
      const response = await axios.get("/api/playdates/upcoming", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPlaydates(response.data);
    } catch (error) {
      console.error("Error fetching scheduled playdates:", error);
    }
  };

  useEffect(() => {
    fetchPlaydates();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPlaydates();
    setRefreshing(false);
  }, []);

  const navigateToDetails = (playdateId) => {
    navigation.navigate("PlaydateDetailsScreen", { playdateId });
  };

  const renderPlaydateItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigateToDetails(item._id)}
      style={[tailwind("p-4 border-b border-gray-200"), styles.playdateItem]}
    >
      <Text style={[tailwind("text-lg font-bold"), styles.playdateTitle]}>
        {item.petsInvolved.map((pet) => pet.name).join(", ")}
      </Text>
      <Text style={styles.playdateDetails}>
        {new Date(item.date).toLocaleDateString()} at{" "}
        {new Date(item.date).toLocaleTimeString()}
      </Text>
      <Text style={styles.locationText}>Location: {item.location.name}</Text>
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={playdates}
      keyExtractor={(item) => item._id}
      renderItem={renderPlaydateItem}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    />
  );
};

// Additional specific styles
const styles = StyleSheet.create({
  playdateItem: {
    // Specific styles for the playdate item
  },
  playdateTitle: {
    // Styles for the playdate title
  },
  playdateDetails: {
    // Styles for the playdate details
    color: "gray", // Example
  },
  locationText: {
    // Styles for the location text
  },
});

export default ScheduledPlaydatesScreen;
