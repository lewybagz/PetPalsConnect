// React component for the Tab Icon
import React, { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { View, Text } from "react-native";

const NotificationTabIcon = ({ focused }) => {
  const [hasRecentUnreadNotifications, setHasRecentUnreadNotifications] =
    useState(false);
  const notifications = useSelector((state) => state.notifications);

  useEffect(() => {
    const checkForRecentUnreadNotifications = () => {
      const recentUnread = notifications.some(
        (notification) =>
          !notification.read &&
          new Date() - new Date(notification.createdAt) < 72 * 60 * 60 * 1000
      );
      setHasRecentUnreadNotifications(recentUnread);
    };

    checkForRecentUnreadNotifications();
  }, [notifications]);

  const iconName = focused ? "ios-notifications" : "ios-notifications-outline";

  return (
    <View style={{ width: 24, height: 24, position: "relative" }}>
      <Ionicons name={iconName} size={24} color="black" />
      {hasRecentUnreadNotifications && (
        <View
          style={{
            position: "absolute",
            right: -6,
            top: -3,
            backgroundColor: "red",
            borderRadius: 6,
            width: 12,
            height: 12,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: "white",
              fontSize: 10,
              fontWeight: "bold",
            }}
          >
            {/* You can add text here if needed, like a number for notification count */}
          </Text>
        </View>
      )}
    </View>
  );
};

export default NotificationTabIcon;
