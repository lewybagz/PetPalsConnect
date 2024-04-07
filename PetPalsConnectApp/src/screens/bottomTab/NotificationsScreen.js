import React, { useState, useEffect } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import NotificationItem from "../../components/NotificationItemComponent";
import axios from "axios";
import { useSelector } from "react-redux";
import { getStoredToken } from "../../../utils/tokenutil";

const NotificationsScreen = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);
  const userId = useSelector((state) => state.user.userId);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = await getStoredToken(); // Retrieve the token
        const response = await axios.get(`/api/notifications/user/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const fetchedNotifications = response.data; // Assuming the response data is an array of notifications
        setNotifications(fetchedNotifications);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };

    fetchNotifications();
  }, [userId]); // Include userId in the dependency array

  return (
    <View style={styles.container}>
      {notifications.length === 0 ? (
        <Text>You have no notifications</Text>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id} // Assuming each notification has a unique '_id' field
          renderItem={({ item }) => (
            <NotificationItem content={item.Content} navigation={navigation} />
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
});

export default NotificationsScreen;
