import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import { useSocketFriendRequest } from "../../hooks/useSocketFriendRequest";
import SwipeableUserPetCard from "../swipe/SwipeableUserPetCard";
import api from "../../api/axios";
import { staleWhileRevalidate, CacheKeys } from "../../services/localCache";

/**
 * Friends list.
 *
 * Rewritten off Realm (end-of-life September 2025) onto the API, with an
 * AsyncStorage cache so the list still renders offline. The previous version
 * also called the `useSocketFriendRequest` hook from inside a `useEffect`
 * callback, which breaks the rules of hooks - it is now called at the top level.
 */
const FriendsListScreen = ({ navigation }) => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadFriends = useCallback(async () => {
    try {
      setError(null);
      await staleWhileRevalidate(
        CacheKeys.friends,
        async () => {
          const { data } = await api.get("/api/friends");
          return data;
        },
        (data) => setFriends(Array.isArray(data) ? data : [])
      );
    } catch (err) {
      setError("Could not load your friends list.");
      console.warn("[friends] load failed:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  // Refresh when a friend request is accepted elsewhere.
  useSocketFriendRequest(loadFriends);

  const friendIds = useMemo(
    () => new Set(friends.map((friend) => friend._id ?? friend.user2)),
    [friends]
  );

  const renderItem = ({ item }) => {
    const petId = item.pets?.length > 0 ? item.pets[0] : null;
    return (
      <SwipeableUserPetCard
        data={item}
        onPress={() => petId && navigation.navigate("PetDetails", { petId })}
        isFriend={friendIds.has(item._id)}
      />
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={friends}
        renderItem={renderItem}
        keyExtractor={(item, index) => String(item._id ?? index)}
        onRefresh={loadFriends}
        refreshing={loading}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.empty}>
              {error ?? "No friends yet. Start matching to add some!"}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  empty: { color: "#666", textAlign: "center" },
});

export default FriendsListScreen;
