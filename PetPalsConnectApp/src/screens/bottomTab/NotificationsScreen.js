import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";

import NotificationItem from "../../components/NotificationItemComponent";
import { Button, EmptyState, ListSkeleton, Screen, Text } from "../../components/ui";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { useSocketNotification } from "../../hooks/useSocketEvents";
import {
  destinationFor,
  fetchNotifications,
  markAllRead,
  markRead,
} from "../../api/notifications";
import {
  markNotificationsRead,
  setNotifications,
  setUnreadCount,
} from "../../redux/actions";

/**
 * Everything the app has told this person.
 *
 * It fetched `/api/notifications/user/${userId}` - an id in the URL when the
 * caller is already in the token, on a route that did not check the two matched
 * - and attached its own Authorization header, which the shared client sets. It
 * kept its own copy of the list in component state, so the tab badge and the
 * screen could not agree; there was no loading state and no empty state beyond
 * a bare line of text; and each row got only `content`, so nothing was tappable.
 *
 * The list lives in the store now, because the badge reads the same numbers.
 */
const NotificationsScreen = ({ navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const dispatch = useDispatch();

  const notifications = useSelector((state) => state.notifications.notifications);
  const unread = useSelector((state) => state.notifications.unread);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  // The hook puts it in the store itself; this screen just re-renders.
  useSocketNotification();

  const load = useCallback(async () => {
    try {
      dispatch(setNotifications(await fetchNotifications()));
      setFailed(false);
    } catch (error) {
      console.warn("[notifications] Could not load:", error.message);
      setFailed(true);
    }
  }, [dispatch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onMarkAllRead = useCallback(async () => {
    // Optimistic: the badge clearing is the whole point of the button, and a
    // failed write is recovered by the next fetch.
    dispatch(markNotificationsRead());
    try {
      dispatch(setUnreadCount(await markAllRead()));
    } catch (error) {
      console.warn("[notifications] Could not mark read:", error.message);
    }
  }, [dispatch]);

  const onOpen = useCallback(
    (notification) => {
      const [screen, params] = destinationFor(notification);

      if (!notification.readStatus) {
        markRead(notification._id).catch(() => {});
        dispatch(
          setNotifications(
            notifications.map((item) =>
              item._id === notification._id ? { ...item, readStatus: true } : item
            )
          )
        );
      }

      // "Notifications" is where we already are: a general notification with
      // nothing behind it should not push a second copy of this screen.
      if (screen !== "Notifications") navigation.navigate(screen, params);
    },
    [dispatch, navigation, notifications]
  );

  if (loading) {
    return (
      <Screen testID="notifications-screen">
        <ListSkeleton count={6} />
      </Screen>
    );
  }

  if (notifications.length === 0) {
    return (
      <Screen testID="notifications-screen">
        <EmptyState
          icon={failed ? "cloud-offline-outline" : "notifications-outline"}
          title={failed ? "Couldn't load notifications" : "Nothing yet"}
          message={
            failed
              ? "Check your connection and try again."
              : "Matches, messages and playdate invitations turn up here."
          }
          actionLabel="Refresh"
          onAction={onRefresh}
        />
      </Screen>
    );
  }

  return (
    <Screen testID="notifications-screen" padded={false}>
      {unread > 0 ? (
        <View style={tailwind("flex-row items-center justify-between px-lg pt-lg")}>
          <Text variant="caption" tone="muted">
            {unread} unread
          </Text>
          <Button
            testID="mark-all-read"
            title="Mark all read"
            variant="ghost"
            fullWidth={false}
            onPress={onMarkAllRead}
          />
        </View>
      ) : null}

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item._id)}
        contentContainerStyle={tailwind("p-lg")}
        renderItem={({ item }) => (
          <NotificationItem notification={item} onPress={() => onOpen(item)} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.primary}
          />
        }
      />
    </Screen>
  );
};

export default NotificationsScreen;
