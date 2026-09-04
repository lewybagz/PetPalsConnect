import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList } from "react-native";
import { useSelector } from "react-redux";

import { useSocketFriendRequest } from "../../hooks/useSocketEvents";
import SwipeableUserPetCard from "../swipe/SwipeableUserPetCard";
import { EmptyState, ListSkeleton, Screen } from "../../components/ui";
import { fetchFriends, otherSide } from "../../api/friends";
import { staleWhileRevalidate, CacheKeys } from "../../services/localCache";
import { useTailwind } from "../../styles/tailwind";

/**
 * Friends list.
 *
 * Rewritten off Realm (end-of-life September 2025) onto the API, with an
 * AsyncStorage cache so the list still renders offline.
 *
 * The rows were wrong in a way nothing could have shown until something was in
 * the list, and nothing ever was: `/api/friends` returns Friend rows -
 * `{ user1, user2, status }` - and each was handed to the card as `data`,
 * which read `data.user._id` and `data.pet._id` off it. The card also switched
 * on a `type` prop this never passed, so every row would have rendered the
 * words "No data", and mapped an undefined `reviews` prop, which throws. This
 * resolves which side of the friendship is the other person and passes that.
 */
const FriendsListScreen = ({ navigation }) => {
  const tailwind = useTailwind();
  const myUserId = useSelector((state) => state.user.userId);

  const [friendships, setFriendships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadFriends = useCallback(async () => {
    try {
      setError(null);
      await staleWhileRevalidate(CacheKeys.friends, fetchFriends, (data) =>
        setFriendships(Array.isArray(data) ? data : [])
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

  const friends = useMemo(
    () =>
      friendships
        .map((friendship) => otherSide(friendship, myUserId))
        .filter((friend) => friend && typeof friend === "object"),
    [friendships, myUserId]
  );

  const onRemoved = useCallback((userId) => {
    setFriendships((current) =>
      current.filter((friendship) => {
        const sides = [friendship.user1, friendship.user2].map((side) =>
          String(side?._id ?? side)
        );
        return !sides.includes(String(userId));
      })
    );
  }, []);

  if (loading) {
    return (
      <Screen testID="friends-screen">
        <ListSkeleton count={5} />
      </Screen>
    );
  }

  if (friends.length === 0) {
    return (
      <Screen testID="friends-screen">
        <EmptyState
          icon={error ? "cloud-offline-outline" : "people-outline"}
          title={error ? "Couldn't load your friends" : "No friends yet"}
          message={
            error ??
            "Match with a pet, say hello, and send their owner a friend request."
          }
          actionLabel={error ? "Try again" : "Find pets"}
          onAction={() =>
            error ? loadFriends() : navigation.navigate("Discover")
          }
        />
      </Screen>
    );
  }

  return (
    <Screen testID="friends-screen" padded={false}>
      <FlatList
        data={friends}
        contentContainerStyle={tailwind("p-lg")}
        keyExtractor={(item, index) => String(item._id ?? index)}
        onRefresh={loadFriends}
        refreshing={false}
        renderItem={({ item }) => (
          <SwipeableUserPetCard
            user={item}
            pet={item.pets?.[0] ?? null}
            isFriend
            navigation={navigation}
            onRemoved={onRemoved}
            onPress={() =>
              item.pets?.[0] &&
              navigation.navigate("PetDetails", {
                petId: String(item.pets[0]?._id ?? item.pets[0]),
              })
            }
          />
        )}
      />
    </Screen>
  );
};

export default FriendsListScreen;
