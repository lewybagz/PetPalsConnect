import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Alert,
  Keyboard,
} from "react-native";
import { useTailwind } from "../../styles/tailwind";
import MessageItemComponent from "../../components/MessageItemComponent";
import { useSelector, useDispatch } from "react-redux";
import LoadingScreen from "../../components/LoadingScreenComponent";
import ChatOptionsModal from "../../components/ChatOptionsModal";
import { FontAwesome as Icon } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { clearError , startLoading, endLoading, setError } from "../../redux/actions";
import { useSocketMessage } from "../../hooks/useSocketEvents";
import api from "../../api/axios";

const ChatScreen = ({ route, navigation }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isModalVisible, setModalVisible] = useState(false);
  const [chatId, setChatId] = useState(null);
  const petInfo = route.params.pet;
  const petId = petInfo?._id;
  const flatListRef = useRef(null);
  const dispatch = useDispatch();
  const tailwind = useTailwind();

  const userId = useSelector((state) => state.user.userId);
  const isLoading = useSelector((state) => state.chat.isLoading);
  const error = useSelector((state) => state.chat.error);

  useSocketMessage((incoming) => {
    // The socket carries every message addressed to this user, not just this
    // thread's, and a message we just posted ourselves can arrive twice.
    if (String(incoming?.chat) !== String(chatId)) return;
    setMessages((current) =>
      current.some((message) => message._id === incoming._id)
        ? current
        : [...current, incoming]
    );
  });

  useEffect(() => {
    if (error) {
      Alert.alert("Chat Error", error, [
        { text: "OK", onPress: () => dispatch(clearError()) },
      ]);
    }
  }, [error, dispatch]);

  /**
   * Opens (or reuses) the conversation with this pet's owner.
   *
   * This used bare `fetch("/api/chat/findOrCreate")`: a relative URL, which in
   * React Native has no origin to resolve against, at a path that is not a
   * mount (`/api/chats`, plural). It also sent `userId` from the client - the
   * server takes the caller from the token, and the other participant from the
   * pet's owner.
   */
  const initiateChat = useCallback(async () => {
    try {
      const { data } = await api.post("/api/chats/findOrCreate", { petId });
      setChatId(data._id);
    } catch (error) {
      console.warn("[chat] Could not open chat:", error.message);
      Alert.alert("Error", "Failed to open this conversation");
    }
  }, [petId]);

  // Messages come from the API. This was a Firestore onSnapshot subscription;
  // the socket hook above delivers live updates now that Mongo is the store.
  const loadMessages = useCallback(async () => {
    if (!chatId) return;
    try {
      const { data } = await api.get(`/api/chats/${chatId}/messages`);
      setMessages(data);
    } catch (err) {
      console.warn("[chat] Could not load messages:", err.message);
      Alert.alert("Error", "Failed to load messages");
    }
  }, [chatId]);

  useEffect(() => {
    initiateChat();
  }, [initiateChat]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const toggleModal = () => {
    setModalVisible(!isModalVisible);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    dispatch(startLoading());
    Keyboard.dismiss();

    try {
      // Messages are stored in MongoDB via the API. They were previously
      // written to Firestore and then announced to the API, which meant two
      // sources of truth for the same conversation.
      // `chatId: petInfo.id` sent the *pet* id (and `.id`, not `._id`), so the
      // server's `Chat.findOne({_id: chatId})` never matched and every send
      // came back 404. The chat id is the one `findOrCreate` returned.
      const { data } = await api.post("/api/chats/addMessage", {
        chatId,
        text: newMessage,
      });

      // The socket push goes to the *recipient*, so without this the sender
      // did not see their own message until the screen reloaded.
      setMessages((current) => [...current, data]);
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message");
      dispatch(setError("Error sending message"));
    } finally {
      dispatch(endLoading());
    }
  };

  const handleReact = async (message, reaction) => {
    try {
      const { data } = await api.post(
        `/api/chats/${chatId}/messages/${message._id}/react`,
        { reaction }
      );
      setMessages((prev) => prev.map((m) => (m._id === data._id ? data : m)));
    } catch (error) {
      console.error("Error reacting to message:", error);
      Alert.alert("Error", "Failed to react to message");
    }
  };

  const handleDelete = async (message) => {
    try {
      await api.delete(`/api/chats/${chatId}/messages/${message._id}`);
      setMessages((prev) => prev.filter((m) => m._id !== message._id));
      Alert.alert("Message Deleted");
    } catch (error) {
      console.error("Error deleting message:", error);
      Alert.alert("Error", "Failed to delete message");
    }
  };

  const copyMessageToClipboard = async (messageText) => {
    await Clipboard.setStringAsync(messageText);
    // Optionally, you can display an alert or toast to inform the user that the text has been copied.
    Alert.alert("Copied to Clipboard", messageText);
  };

  const renderMessageItem = ({ item }) => {
    // The schema has `sender` and `contentText`; this read `senderId` and
    // `ContentText`, so every message rendered as someone else's and copying
    // one copied `undefined`.
    const isSender = String(item.sender) === String(userId);
    return (
      <MessageItemComponent
        message={item}
        isSender={isSender}
        onDelete={handleDelete}
        onReact={(reaction) => handleReact(item, reaction)}
        onCopy={() => copyMessageToClipboard(item.contentText)}
      />
    );
  };

  // Automatically scroll to the newest message
  useEffect(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  // Declared after every hook so hook order stays stable across renders.
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <View style={tailwind("flex-1")}>
      {/* this is how they are displayed in chat */}
      <View style={styles.header}>
        <Image source={{ uri: petInfo?.photos?.[0] }} style={styles.petImage} />
        <Text style={tailwind("text-lg font-bold")}>{petInfo.name}</Text>
        <ChatOptionsModal
          isVisible={isModalVisible}
          onClose={toggleModal}
          navigation={navigation}
        />
      </View>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item._id}
        renderItem={renderMessageItem}
        style={tailwind("flex-1")}
      />
      <View
        style={tailwind("flex-row items-center p-2 border-t border-gray-300")}
      >
        <TextInput
          style={tailwind("flex-1 border border-gray-300 p-2 rounded mr-2")}
          placeholder="Send a PAWesome message..."
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          editable={!isLoading}
        />
        {isLoading ? (
          <LoadingScreen />
        ) : (
          <TouchableOpacity onPress={handleSendMessage} disabled={isLoading}>
            <Icon name="send" size={24} color="#007bff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  petImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
});

export default ChatScreen;
