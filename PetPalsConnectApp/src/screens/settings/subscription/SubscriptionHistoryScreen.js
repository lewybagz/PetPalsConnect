import React, { useState, useEffect } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import axios from "axios";

const SubscriptionHistoryScreen = () => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchSubscriptionHistory = async () => {
      try {
        const response = await axios.get("/api/subscription-history");
        setHistory(response.data);
      } catch (error) {
        console.error("Error fetching subscription history:", error);
        // Handle error - show alert or a message
      }
    };

    fetchSubscriptionHistory();
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={history}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.historyItem}>
            <Text style={styles.date}>{item.date}</Text>
            <Text style={styles.details}>Plan: {item.plan}</Text>
            <Text style={styles.details}>Amount: {item.amount}</Text>
            <Text style={styles.details}>Status: {item.status}</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  historyItem: {
    backgroundColor: "#f0f0f0",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  date: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  details: {
    fontSize: 16,
  },
});

export default SubscriptionHistoryScreen;
