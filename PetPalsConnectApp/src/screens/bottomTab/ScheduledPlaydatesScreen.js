// ScheduledPlaydatesScreen.js
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import api from "../../api/axios";
import { useTailwind } from "../../styles/tailwind";
import { getStoredToken } from "../../../utils/tokenutil";
import { useTokens } from "../../context/AppThemeContext";

const ScheduledPlaydatesScreen = (navigation) => {
  const tokens = useTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const [playdates, setPlaydates] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const tailwind = useTailwind();

  const fetchPlaydates = async () => {
    try {
      const token = await getStoredToken(); // Retrieve the token
      const response = await api.get("/api/playdates/upcoming", {
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
    navigation.navigate("PlaydateDetails", { playdateId });
  };

  const renderPlaydateItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigateToDetails(item._id)}
      style={[tailwind("p-4 border-b border-border"), styles.playdateItem]}
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
const makeStyles = (t) => StyleSheet.create({
  playdateItem: {
    // Specific styles for the playdate item
  },
  playdateTitle: {
    // Styles for the playdate title
  },
  playdateDetails: {
    // Styles for the playdate details
    color: t.textMuted, // Example
  },
  locationText: {
    // Styles for the location text
  },
});

export default ScheduledPlaydatesScreen;
