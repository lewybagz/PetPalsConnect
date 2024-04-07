import React, { useState, useEffect } from "react";
import { FlatList, Text, StyleSheet, RefreshControl } from "react-native";
import LoadingScreen from "../../components/LoadingScreenComponent";
import ChatCard from "../../components/ChatCardComponent";
import axios from "axios";
import { getStoredToken } from "../../../utils/tokenutil";

const ChatsScreen = ({ navigation }) => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchChats = async () => {
    try {
      setLoading(true);
      const token = await getStoredToken(); // Retrieve the token
      const response = await axios.get("/api/chats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setChats(response.data); // Assuming the response data is the array of chats
    } catch (e) {
      setError("Failed to load chats: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchChats().then(() => setRefreshing(false));
  };

  const handleChatPress = (chat) => {
    navigation.navigate("ChatDetail", { chatId: chat.id });
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  if (chats.length === 0) {
    return <Text style={styles.empty}>No chats available</Text>;
  }

  return (
    <FlatList
      data={chats}
      renderItem={({ item }) => (
        <ChatCard
          chat={item}
          onPress={handleChatPress}
          navigation={navigation}
        />
      )}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    />
  );
};

const styles = StyleSheet.create({
  loader: {
    marginTop: 20,
  },
  empty: {
    marginTop: 20,
    textAlign: "center",
  },
  error: {
    marginTop: 20,
    textAlign: "center",
    color: "red",
  },
});

export default ChatsScreen;
