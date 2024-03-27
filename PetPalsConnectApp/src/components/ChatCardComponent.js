import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from "react-native";
import { useTailwind } from "nativewind";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";

const ChatCard = ({ chat, onPress, isGroupChat, setChats }) => {
  const tailwind = useTailwind();
  const navigation = useNavigation();
  const [modalVisible, setModalVisible] = useState(false);

  const handleLongPress = () => setModalVisible(true);
  const handleCloseModal = () => setModalVisible(false);

  const handleArchiveChat = async () => {
    try {
      const endpoint = isGroupChat
        ? `/api/groupchats/${chat.id}/archive`
        : `/api/chats/${chat.id}/archive`;

      const response = await axios.post(endpoint); // Capture the response
      const updatedChat = response.data;

      // Update local chats state
      setChats((prevChats) =>
        prevChats.map((c) => (c.id === chat.id ? updatedChat : c))
      );
    } catch (error) {
      console.error("Failed to archive chat:", error);
      alert("Failed to archive chat."); // Displaying error to the user
    }
    handleCloseModal();
  };

  const handleDeleteChat = async () => {
    try {
      const endpoint = isGroupChat
        ? `/api/groupchats/${chat.id}`
        : `/api/chats/${chat.id}`;

      const response = await axios.delete(endpoint); // Capture the response
      const updatedChat = response.data;
      setChats((prevChats) =>
        prevChats.map((c) => (c.id === chat.id ? updatedChat : c))
      );
    } catch (error) {
      console.error("Failed to delete chat:", error);
      alert("Failed to delete chat.");
    }
    handleCloseModal();
  };

  const handleViewDetails = () => {
    // If you need to fetch details, you can make an API call here.
    // Or navigate to a screen with detailed information about the chat.
    // For example:
    navigation.navigate("ChatDetailsScreen", { chatId: chat.id });

    handleCloseModal();
  };

  const handlePinChat = async () => {
    try {
      await axios.post(`/api/chats/${chat.id}/pin`);
      // Optionally update local state or trigger re-fetch
    } catch (error) {
      console.error("Failed to pin chat:", error);
      // Handle error
    }
    handleCloseModal();
  };
  const formattedTimestamp = new Date(
    chat.lastMessageTimestamp
  ).toLocaleTimeString();

  return (
    <TouchableOpacity
      onPress={() => onPress(chat)}
      onLongPress={handleLongPress}
    >
      <View style={styles.card}>
        {chat.picture && (
          <Image source={{ uri: chat.picture }} style={styles.chatImage} />
        )}
        <View style={styles.details}>
          <Text style={styles.title}>{chat.name}</Text>
          <Text style={styles.messagePreview}>{chat.lastMessage}</Text>
          <Text style={styles.timestamp}>{formattedTimestamp}</Text>
        </View>
        {chat.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadCount}>{chat.unreadCount}</Text>
          </View>
        )}
      </View>
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={tailwind("flex-1 justify-end bg-opacity-50 bg-black")}>
          <View style={tailwind("bg-white p-4 rounded-t-3xl")}>
            {/* Archive Chat */}
            <TouchableOpacity style={styles.option} onPress={handleArchiveChat}>
              <Text style={tailwind("text-lg text-center")}>Archive Chat</Text>
            </TouchableOpacity>

            {/* Delete Chat */}
            <TouchableOpacity style={styles.option} onPress={handleDeleteChat}>
              <Text style={tailwind("text-lg text-center")}>Delete Chat</Text>
            </TouchableOpacity>

            {/* Chat Details */}
            <TouchableOpacity style={styles.option} onPress={handleViewDetails}>
              <Text style={tailwind("text-lg text-center")}>Chat Details</Text>
            </TouchableOpacity>

            {/* Pin Chat */}
            <TouchableOpacity style={styles.option} onPress={handlePinChat}>
              <Text style={tailwind("text-lg text-center")}>Pin Chat</Text>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.cancelOption}
              onPress={handleCloseModal}
            >
              <Text style={tailwind("text-lg text-center")}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    alignItems: "center",
  },
  chatImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  details: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
  },
  messagePreview: {
    fontSize: 14,
    color: "gray",
  },
  timestamp: {
    fontSize: 12,
    color: "gray",
    marginTop: 5,
  },
  unreadBadge: {
    backgroundColor: "red",
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadCount: {
    color: "white",
    fontWeight: "bold",
  },
});

export default ChatCard;
