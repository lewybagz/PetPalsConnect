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
import {
  broughtBy,
  otherParticipant,
  otherPet,
  petPhoto,
} from "../utils/petIdentity";
import { hit, space } from "../styles/tokens";

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
 * `pets` (both animals, populated with name, photos and owner),
 * `lastMessage.contentText`, and `updatedAt`.
 *
 * The row is titled with the *pet* you are talking to, not their owner. A
 * conversation in this app exists because two animals matched; an inbox listing
 * usernames is listing the people who happen to be holding the leads. The owner
 * is still there, on the second line, because you may be about to arrange to
 * meet them in a park.
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

  // The pet the conversation is with, and the person bringing them.
  const other = otherParticipant(chat, userId);
  const pet = isGroupChat ? null : otherPet(chat, userId);

  const title = isGroupChat
    ? chat?.name ?? chat?.groupName ?? "Group"
    : pet?.name ?? other?.username ?? "Conversation";

  // In a group, the members are pets too - the creation screen picks animals
  // and derives their owners silently.
  const subtitle = isGroupChat
    ? (chat?.pets ?? []).length
      ? `${chat.pets.length} pets`
      : null
    : broughtBy(other);

  const photo =
    (isGroupChat ? chat?.groupImage : petPhoto(pet)) ??
    other?.userPhoto ??
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
      accessibilityLabel={
        subtitle ? `Conversation with ${title}, ${subtitle}` : `Conversation with ${title}`
      }
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
          {subtitle ? (
            <Text style={styles.owner} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
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
              <Text style={tailwind("text-lg text-center text-text")}>Archive Chat</Text>
            </TouchableOpacity>

            {/* Delete Chat */}
            <TouchableOpacity style={styles.option} onPress={handleDeleteChat}>
              <Text style={tailwind("text-lg text-center text-text")}>Delete Chat</Text>
            </TouchableOpacity>

            {/* Chat Details */}
            <TouchableOpacity style={styles.option} onPress={handleViewDetails}>
              <Text style={tailwind("text-lg text-center text-text")}>Chat Details</Text>
            </TouchableOpacity>

            {/* Pin Chat */}
            <TouchableOpacity style={styles.option} onPress={handlePinChat}>
              <Text style={tailwind("text-lg text-center text-text")}>Pin Chat</Text>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.cancelOption}
              onPress={handleCloseModal}
            >
              <Text style={tailwind("text-lg text-center text-text")}>Cancel</Text>
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
  // Referenced by the five menu rows and never defined, so each was a bare
  // text node - no padding and well under the 44pt tap floor.
  option: {
    minHeight: hit.min,
    justifyContent: "center",
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  cancelOption: {
    minHeight: hit.min,
    justifyContent: "center",
    paddingVertical: space.md,
    marginTop: space.sm,
  },
  details: {
    flex: 1,
  },
  title: {
    color: t.text,
    fontSize: 16,
    fontWeight: "bold",
  },
  owner: {
    fontSize: 12,
    color: t.textFaint,
    marginBottom: 2,
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
