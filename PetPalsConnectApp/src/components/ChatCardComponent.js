import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from "react-native";
import { useSelector } from "react-redux";

import { useTailwind } from "../styles/tailwind";
import api from "../api/axios";
import { useTokens } from "../context/AppThemeContext";
import { hit } from "../styles/tokens";

/**
 * One row in the inbox.
 *
 * It read five fields a Chat document does not have. `chat.lastMessage` is a
 * populated *Message*, and rendering an object as a child throws - so the inbox
 * crashed the moment it had a conversation in it, which is why no test caught
 * it: the suites all render an empty or mocked list. `chat.name`,
 * `chat.picture`, `chat.lastMessageTimestamp` and `chat.unreadCount` do not
 * exist either, so the row showed a blank title, no photo and "Invalid Date".
 *
 * The real shape: `participants` (populated with username and userPhoto),
 * `petId` (populated with name and photos), `lastMessage.contentText`, and
 * `updatedAt`. The other participant is whoever is not you.
 *
 * Every id is `_id`; `chat.id` is undefined on a Mongo document, so archive,
 * delete, pin and details all posted to `/api/chats/undefined/...`.
 */
const ChatCard = ({ chat, onPress, isGroupChat, setChats, navigation }) => {
  const tokens = useTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const tailwind = useTailwind();
  const userId = useSelector((state) => state.user.userId);
  const [modalVisible, setModalVisible] = useState(false);

  const chatId = chat?._id;

  // The conversation is with whoever is not you. A group chat has its own name.
  const other = (chat?.participants ?? []).find(
    (participant) => String(participant?._id ?? participant) !== String(userId)
  );

  const title =
    (isGroupChat ? chat?.name : other?.username) ??
    chat?.petId?.name ??
    "Conversation";

  const photo =
    other?.userPhoto ??
    (Array.isArray(chat?.petId?.photos) ? chat.petId.photos[0] : null) ??
    null;

  const preview = chat?.lastMessage?.contentText ?? "No messages yet";

  const stamp = chat?.lastMessage?.timestamp ?? chat?.updatedAt;
  const when = stamp
    ? new Date(stamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";

  const handleLongPress = () => setModalVisible(true);
  const handleCloseModal = () => setModalVisible(false);

  const handleArchiveChat = async () => {
    try {
      const endpoint = isGroupChat
        ? `/api/groupchats/${chatId}/archive`
        : `/api/chats/${chatId}/archive`;

      const response = await api.post(endpoint, {});
      const updatedChat = response.data;

      // Update local chats state
      setChats((prevChats) =>
        prevChats.map((c) => (c._id === chatId ? updatedChat : c))
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
        ? `/api/groupchats/${chatId}`
        : `/api/chats/${chatId}`;

      const response = await api.delete(endpoint);
      const updatedChat = response.data;
      setChats((prevChats) =>
        prevChats.map((c) => (c._id === chatId ? updatedChat : c))
      );
    } catch (error) {
      console.error("Failed to delete chat:", error);
      alert("Failed to delete chat.");
    }
    handleCloseModal();
  };

  const handleViewDetails = () => {
    // Assuming you have navigation passed as a prop to this component
    navigation.navigate("ChatDetails", {
      chatId,
      isGroupChat,
    });

    handleCloseModal();
  };

  const handlePinChat = async () => {
    try {
      await api.post(`/api/chats/${chatId}/pin`, {});
    } catch (error) {
      console.error("Failed to pin chat:", error);
      // Handle error
    }
    handleCloseModal();
  };
  return (
    <TouchableOpacity
      testID={`chat-${chatId}`}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${title}`}
      onPress={() => onPress(chat)}
      onLongPress={handleLongPress}
    >
      <View style={styles.card}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.chatImage} />
        ) : (
          <View style={[styles.chatImage, styles.placeholder]} />
        )}
        <View style={styles.details}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.messagePreview} numberOfLines={1}>
            {preview}
          </Text>
        </View>
        {when ? <Text style={styles.timestamp}>{when}</Text> : null}
      </View>
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={tailwind("flex-1 justify-end bg-scrim")}>
          <View style={tailwind("bg-surface p-4 rounded-t-3xl")}>
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

const makeStyles = (t) => StyleSheet.create({
  card: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
    alignItems: "center",
    // A whole row is the tap target; 10pt of padding round one line was not.
    minHeight: hit.min + 16,
  },
  chatImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  placeholder: {
    backgroundColor: t.surfaceAlt,
  },
  details: {
    flex: 1,
  },
  title: {
    color: t.text,
    fontSize: 16,
    fontWeight: "bold",
  },
  messagePreview: {
    fontSize: 14,
    color: t.textMuted,
  },
  timestamp: {
    fontSize: 13,
    color: t.textMuted,
    marginLeft: 8,
  },
  unreadBadge: {
    backgroundColor: t.danger,
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadCount: {
    color: t.surface,
    fontWeight: "bold",
  },
});

export default ChatCard;
