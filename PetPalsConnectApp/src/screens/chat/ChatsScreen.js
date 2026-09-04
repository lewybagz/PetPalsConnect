import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";

import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { EmptyState, ListSkeleton, Screen } from "../../components/ui";
import ChatCard from "../../components/ChatCardComponent";
import api from "../../api/axios";

/**
 * The inbox.
 *
 * `keyExtractor={(item) => item.id}` read a field Mongo does not serialise -
 * every key was `undefined`, so React could not tell one row from another and
 * recycling put the wrong conversation behind the wrong name after a refresh.
 * It also fetched a token by hand and set the Authorization header itself,
 * which `src/api/axios` has done for every request since it was written.
 *
 * The waits were a full-screen spinner and the two outcomes were bare centred
 * sentences - "No chats available" in the same weight and colour as an error.
 * A list of rows is the most predictable structure in the app, so it gets
 * skeleton rows, and the two end states now read differently because they mean
 * different things.
 */
const ChatsScreen = ({ navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();

  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchChats = useCallback(async () => {
    try {
      setError(null);
      const { data } = await api.get("/api/chats");
      setChats(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn("[chats]", e.message);
      setError("We couldn't load your conversations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchChats();
  };

  if (loading) {
    return (
      <Screen testID="chats-loading" padded={false}>
        <ListSkeleton count={7} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen testID="chats-error" padded={false}>
        <EmptyState
          testID="chats-error-state"
          icon="cloud-offline-outline"
          title="Something went wrong"
          message={error}
          actionLabel="Try again"
          onAction={() => {
            setLoading(true);
            fetchChats();
          }}
        />
      </Screen>
    );
  }

  if (chats.length === 0) {
    return (
      <Screen testID="chats-empty" padded={false}>
        <EmptyState
          testID="chats-empty-state"
          icon="chatbubbles-outline"
          title="No conversations yet"
          message="Match with a pet and say hello - your chats will show up here."
          actionLabel="Find matches"
          onAction={() => navigation.navigate("Discover")}
        />
      </Screen>
    );
  }

  return (
    <View style={tailwind("flex-1 bg-bg")}>
      <FlatList
        testID="chats-list"
        data={chats}
        renderItem={({ item }) => (
          <ChatCard
            chat={item}
            // The route is "ChatDetails", and Mongo documents serialise `_id`.
            onPress={() => navigation.navigate("ChatDetails", { chatId: item._id })}
            navigation={navigation}
          />
        )}
        keyExtractor={(item) => String(item._id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={tokens.textMuted}
            onRefresh={onRefresh}
          />
        }
      />
    </View>
  );
};

export default ChatsScreen;
