import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
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
import SafetyMenu from "../../components/SafetyMenu";
import { useToast } from "../../components/ui";
import api from "../../api/axios";
import { useTokens } from "../../context/AppThemeContext";

/** You block a person, not a dog. `owner` may be an id or a populated user. */
const ownerId = (pet) => {
  const owner = pet?.owner;
  return owner == null ? null : String(owner?._id ?? owner);
};

const ChatScreen = ({ route, navigation }) => {
  const tokens = useTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isModalVisible, setModalVisible] = useState(false);
  // A message notification carries a chat id and nothing else - it is raised by
  // the server, which has no pet in scope. This read `route.params.pet`
  // unguarded, so opening a chat from a push landed on a screen that asked the
  // API to find-or-create a conversation with `petId: undefined` and then said
  // "Could not open this conversation."
  const [chatId, setChatId] = useState(route?.params?.chatId ?? null);
  const [otherUserId, setOtherUserId] = useState(null);
  const [petInfo, setPetInfo] = useState(route?.params?.pet ?? null);
  const petId = petInfo?._id;
  const flatListRef = useRef(null);
  const dispatch = useDispatch();
  const tailwind = useTailwind();
  const toast = useToast();

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
      toast.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch, toast]);

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
      // Arriving from a notification we already have the conversation; ask for
      // it rather than trying to derive it from a pet we were not given.
      const { data } = petId
        ? await api.post("/api/chats/findOrCreate", { petId })
        : await api.get(`/api/chats/${chatId}`);

      setChatId(data._id);
      if (!petInfo && data.petId) setPetInfo(data.petId);

      // The person on the other end, for the block-and-report menu. Taken from
      // the chat rather than the pet, because a pet reached through the match
      // modal arrives without its owner populated.
      const other = (data.participants ?? [])
        .map((participant) => String(participant?._id ?? participant))
        .find((participant) => participant !== String(userId));
      setOtherUserId(other ?? ownerId(petInfo));
    } catch (error) {
      console.warn("[chat] Could not open chat:", error.message);
      // 403 is the server refusing a conversation one side has blocked. Saying
      // so plainly beats "failed to open", which reads as a bug.
      toast.error(
        error.response?.status === 403
          ? "This conversation isn't available."
          : "Could not open this conversation."
      );
    }
  }, [petId, userId, petInfo, toast]);

  // Messages come from the API. This was a Firestore onSnapshot subscription;
  // the socket hook above delivers live updates now that Mongo is the store.
  const loadMessages = useCallback(async () => {
    if (!chatId) return;
    try {
      const { data } = await api.get(`/api/chats/${chatId}/messages`);
      setMessages(data);
    } catch (err) {
      console.warn("[chat] Could not load messages:", err.message);
      toast.error("Could not load messages.");
    }
  }, [chatId, toast]);

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
      dispatch(setError("Message not sent. Tap send to try again."));
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
      toast.error("Could not add that reaction.");
    }
  };

  const handleDelete = async (message) => {
    try {
      await api.delete(`/api/chats/${chatId}/messages/${message._id}`);
      setMessages((prev) => prev.filter((m) => m._id !== message._id));
      toast.show("Message deleted");
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Could not delete that message.");
    }
  };

  const copyMessageToClipboard = async (messageText) => {
    await Clipboard.setStringAsync(messageText);
    // Was an alert showing the copied text back - a modal to confirm the thing
    // the user just watched happen.
    toast.show("Copied");
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
        <Text style={tailwind("flex-1 text-lg font-bold")}>{petInfo?.name}</Text>

        {/* A conversation with a stranger is the place people most need to get
            out of one. There was no way to block or report from here at all. */}
        <SafetyMenu
          testID="chat-safety"
          userId={otherUserId}
          name={petInfo?.name ? `${petInfo.name}'s owner` : "this person"}
          navigation={navigation}
          onBlocked={() => {
            toast.success("Blocked. You won't hear from them again.");
            navigation.goBack();
          }}
          extraOptions={[{ label: "Chat options", testID: "chat-options", onPress: toggleModal }]}
        />

        <ChatOptionsModal
          isVisible={isModalVisible}
          onClose={toggleModal}
          navigation={navigation}
          // The sheet read the id out of the store, where nothing set it for a
          // one-to-one chat, so both of its actions ran against `undefined`.
          chatId={chatId}
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
        style={tailwind("flex-row items-center p-2 border-t border-border")}
      >
        <TextInput
          style={tailwind("flex-1 border border-border p-2 rounded mr-2")}
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
            <Icon name="send" size={24} color={tokens.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const makeStyles = (t) => StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  petImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
});

export default ChatScreen;
