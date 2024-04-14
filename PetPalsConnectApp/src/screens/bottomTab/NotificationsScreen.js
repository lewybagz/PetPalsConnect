import React, { useState, useEffect } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import NotificationItem from "../../components/NotificationItemComponent";
import axios from "axios";
import { useSelector } from "react-redux";
import { useSocketNotification } from "../../hooks/useSocketNotification";
import { getStoredToken } from "../../../utils/tokenutil";

const NotificationsScreen = ({ navigation }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const userId = useSelector((state) => state.userReducer.userId);

  useSocketNotification(setNotifications);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = await getStoredToken();
        const response = await axios.get(`/api/notifications/user/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setNotifications(response.data);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };

    fetchNotifications();
  }, [userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const token = await getStoredToken();
      const response = await axios.get(`/api/notifications/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(response.data);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      {notifications.length === 0 ? (
        <Text>You have no notifications</Text>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <NotificationItem content={item.Content} navigation={navigation} />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
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
