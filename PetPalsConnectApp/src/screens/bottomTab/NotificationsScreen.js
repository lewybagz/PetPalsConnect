import React, { useState, useEffect } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import NotificationItem from "../../components/NotificationItemComponent";
import api from "../../api/axios";
import { useSelector } from "react-redux";
import { useSocketNotification } from "../../hooks/useSocketEvents";
import { getStoredToken } from "../../../utils/tokenutil";

const NotificationsScreen = ({ navigation }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const userId = useSelector((state) => state.user.userId);

  // The old hook prepended to the list itself and this passed the setter, so a
  // live notification would have *replaced* the whole list with one object.
  useSocketNotification((notification) =>
    setNotifications((current) => [notification, ...current])
  );

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = await getStoredToken();
        const response = await api.get(`/api/notifications/user/${userId}`, {
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
      const response = await api.get(`/api/notifications/user/${userId}`, {
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
            <NotificationItem content={item.content} navigation={navigation} />
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
