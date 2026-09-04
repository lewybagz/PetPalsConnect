import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { View } from "react-native";

import { Text } from "./ui";
import { useTokens } from "../context/AppThemeContext";
import { useTailwind } from "../styles/tailwind";

/**
 * The notifications tab, with its unread badge.
 *
 * Three things were wrong with this at once, and the first of them took the
 * whole tab bar down: it read `useSelector((state) => state.notifications)`,
 * which is the slice object `{ notifications: [] }`, and then called `.some` on
 * it - a TypeError on the first render of every signed-in screen. Had that
 * worked, it filtered on `notification.read` and `notification.createdAt`,
 * neither of which is a field on the schema (`readStatus` and `timestamp`), so
 * the badge could never have appeared. And `ios-notifications` was removed in
 * react-native-vector-icons v10, so the icon itself rendered blank.
 *
 * The count now comes from the store, which the screen and the push handler
 * both keep current, so the badge does not need its own fetch.
 */
const NotificationTabIcon = ({ focused }) => {
  const tokens = useTokens();
  const tailwind = useTailwind();
  const unread = useSelector((state) => state.notifications.unread);

  return (
    <View
      accessibilityLabel={
        unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
      }
      style={{ width: 24, height: 24 }}
    >
      <Ionicons
        name={focused ? "notifications" : "notifications-outline"}
        size={24}
        color={focused ? tokens.primary : tokens.textMuted}
      />
      {unread > 0 && (
        <View
          testID="notification-badge"
          style={[
            tailwind("bg-danger items-center justify-center"),
            {
              position: "absolute",
              right: -6,
              top: -3,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              paddingHorizontal: 3,
            },
          ]}
        >
          <Text variant="caption" tone="onPrimary" style={{ fontSize: 10 }}>
            {unread > 9 ? "9+" : unread}
          </Text>
        </View>
      )}
    </View>
  );
};

export default NotificationTabIcon;
