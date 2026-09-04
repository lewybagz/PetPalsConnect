import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Card, Text } from "./ui";
import { useTailwind } from "../styles/tailwind";
import { useTokens } from "../context/AppThemeContext";
import { normaliseType } from "../api/notifications";

/**
 * One row in the notifications list.
 *
 * It took only `content`, so a notification was a line of text with a
 * three-dot menu next to it and nowhere to go. The menu held "Notification
 * Settings" and "Mute Notifications", the second of which patched *all five*
 * preferences to false from a per-row menu - a global mute reachable by
 * mis-tapping a row. Settings owns that; this is a row you tap to get to the
 * thing it is telling you about.
 */

/** An icon per kind, so the list is readable without reading every line. */
const ICONS = {
  message: "chatbubble-ellipses-outline",
  groupMessage: "chatbubbles-outline",
  messageReaction: "heart-outline",
  friendRequest: "person-add-outline",
  friendAccepted: "people-outline",
  petMatch: "paw-outline",
  playdate: "calendar-outline",
  playdateAccepted: "checkmark-circle-outline",
  playdateDeclined: "close-circle-outline",
  playdateCancelled: "calendar-clear-outline",
  reviewReminder: "star-outline",
  general: "notifications-outline",
};

/** "3 minutes ago" without pulling in a date library for one string. */
export const relativeTime = (value) => {
  const then = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(then)) return "";

  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(then).toLocaleDateString();
};

const NotificationItem = ({ notification, onPress }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();

  const type = normaliseType(notification?.type);
  const unread = !notification?.readStatus;

  return (
    <Card
      testID={`notification-${notification?._id}`}
      onPress={onPress}
      accessibilityLabel={`${notification?.content ?? ""}${unread ? ", unread" : ""}`}
      style={tailwind("mb-sm flex-row items-center")}
    >
      <Ionicons
        name={ICONS[type] ?? ICONS.general}
        size={22}
        color={unread ? tokens.primary : tokens.textMuted}
      />

      <View style={tailwind("flex-1 ml-md")}>
        <Text variant="body" tone={unread ? "default" : "muted"}>
          {notification?.content ?? ""}
        </Text>
        <Text variant="caption" tone="muted" style={tailwind("mt-xs")}>
          {relativeTime(notification?.timestamp)}
        </Text>
      </View>

      {unread ? (
        <View
          testID="unread-dot"
          style={[
            tailwind("bg-primary"),
            { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
          ]}
        />
      ) : null}
    </Card>
  );
};

export default NotificationItem;
