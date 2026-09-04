// FriendRequestsScreen.js
import React, { useState, useEffect, useMemo } from "react";
import { View, FlatList, StyleSheet, Alert } from "react-native";
import api from "../../api/axios";
import FriendRequestsCard from "../../components/FriendRequestsCard";
import { getStoredToken } from "../../../utils/tokenutil";
import { setError } from "../../redux/actions";
import { useTokens } from "../../context/AppThemeContext";

const FriendRequestsScreen = () => {
  const tokens = useTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const [friendRequests, setFriendRequests] = useState([]);
  const getToken = async () => {
    try {
      const token = await getStoredToken();
      return token;
    } catch (err) {
      setError(err.message);
    }
  };
  useEffect(() => {
    // Fetch friend requests from the server
    const fetchFriendRequests = async (token) => {
      getToken();
      try {
        // Replace with your actual endpoint
        const response = await api.get("/api/friendrequests", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFriendRequests(response.data);
      } catch (error) {
        console.error("Error fetching friend requests:", error);
      }
    };

    fetchFriendRequests();
  }, []);

  const handleAccept = async (friendRequest, token) => {
    getToken();
    try {
      // Send an update to the server to accept the friend request
      const response = await api.put(
        `/api/friendrequests/${friendRequest._id}/accept`,
        {}, // Since the token is sent in the headers, no need for body if no additional data is sent
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      Alert.alert(response.data.message);
    } catch (error) {
      console.error("Error accepting friend request:", error);
      Alert.alert("Error", "Failed to accept friend request");
    }
  };

  const handleDecline = async (friendRequest, token) => {
    getToken();
    try {
      const response = await api.put(
        `/api/friendrequests/${friendRequest._id}/decline`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      Alert.alert(response.data.message);
    } catch (error) {
      console.error("Error declining friend request:", error);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={friendRequests}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <FriendRequestsCard
            friendRequest={item}
            onAccept={handleAccept}
            onDecline={handleDecline}
          />
        )}
      />
    </View>
  );
};

const makeStyles = (t) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.surfaceAlt,
  },
});

export default FriendRequestsScreen;
