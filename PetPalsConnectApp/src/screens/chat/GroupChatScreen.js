import React, { useState, useEffect, useRef, useMemo } from "react";
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
import UserPetCard from "../../components/UserPetCardComponent";
import LoadingScreen from "../../components/LoadingScreenComponent";
import GroupOptionsModal from "../../components/GroupOptionsModal";
import MessageItemComponent from "../../components/MessageItemComponent";
import { FontAwesome as Icon } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useSocketMessage } from "../../hooks/useSocketEvents";
import api from "../../api/axios";
import { useSelector } from "react-redux";
import { useTokens } from "../../context/AppThemeContext";

const GroupChatScreen = ({ route, navigation }) => {
  const tokens = useTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const [pets, setPets] = useState([]);
  const [searchType, setSearchType] = useState("messages");
  const [isModalVisible, setModalVisible] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [isSearchEnabled, setSearchEnabled] = useState(false);
  const messageInputRef = useRef(null);
  // Both callers navigate here with `{ chatId }`; this read `route.params.group`
  // and then `route.params.group._id`, so opening a group chat threw on
  // undefined. Accept either, and look the group up when given an id.
  const groupId = route?.params?.chatId ?? route?.params?.group?._id;
  const [groupInfo, setGroupInfo] = useState(route?.params?.group ?? null);
  const flatListRef = useRef(null);
  const userId = useSelector((state) => state.user.userId);
  const tailwind = useTailwind();

  // Setting up the socket to handle real-time group chat messages
  useSocketMessage((newMessage) => {
    setMessages((prevMessages) => [...prevMessages, newMessage]);
  });

  useEffect(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  // Messages come from the API. This was a Firestore onSnapshot subscription;
  // Mongo is the store now and the socket hook delivers live updates.
  const loadMessages = async () => {
    try {
      const { data } = await api.get(`/api/groupchats/${groupId}/messages`);
      setMessages(data);
    } catch (error) {
      console.warn("[groupchat] Could not load messages:", error.message);
      Alert.alert("Error", "Failed to load messages");
    }
  };

  // Both of these used bare `fetch` with a relative URL. React Native has no
  // origin to resolve one against, so they never reached the server - and the
  // second was missing even its leading slash. The shared client has the base
  // URL and attaches the token itself.
  const fetchPetsData = async (groupId) => {
    try {
      const { data } = await api.get(`/api/groupchats/${groupId}/pets`);
      setPets(data);
    } catch (error) {
      console.warn("[groupchat] Could not load pets:", error.message);
      Alert.alert("Error", "Failed to load pets data");
    }
  };
  const fetchGroupInfo = async () => {
    try {
      const { data } = await api.get(`/api/groupchats/${groupId}`);
      setGroupInfo(data);
    } catch (error) {
      console.error("Error fetching group info:", error);
    }
  };

  // Everything below keyed off `groupInfo.id`. Mongo documents serialise with
  // `_id`, not `id` - Mongoose's default toJSON does not include the virtual -
  // so that was `undefined` on every read, the effect never ran, and the screen
  // stayed empty. The id from the route is what the callers actually have.
  useEffect(() => {
    if (!groupId) return;
    fetchGroupInfo();
    fetchPetsData(groupId);
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);



  const copyMessageToClipboard = async (messageText) => {
    await Clipboard.setStringAsync(messageText);
    Alert.alert("Copied to Clipboard", messageText);
  };

  // `pet.id` is not a field on a Mongoose document serialised to JSON - it is
  // `_id` - so tapping a pet in the group header navigated with an undefined
  // id and PetDetails rendered nothing.
  const handlePetSelect = (pet) => {
    const petId = pet?._id ?? pet?.id;
    if (petId) navigation.navigate("PetDetails", { petId: String(petId) });
  };

  const toggleSearch = () => {
    setSearchEnabled(!isSearchEnabled);
    setSearchQuery("");
  };
  const handleReply = (message) => {
    const replyString = `@${message.sender}: `;
    setReplyTo(replyString);
    setNewMessage(replyString);
    messageInputRef.current.focus();
  };
  const handleDelete = async (message) => {
    try {
      await api.delete(
        `/api/groupchats/${groupId}/messages/${message._id}`
      );
      setMessages((prev) => prev.filter((m) => m._id !== message._id));
      Alert.alert("Message Deleted");
    } catch (error) {
      console.error("Error deleting message:", error);
      Alert.alert("Error", "Failed to delete message");
    }
  };

  const handleReact = async (message, reaction) => {
    try {
      await api.post("/api/groupchats/react", {
        groupId,
        messageId: message._id,
        reaction,
      });

      setMessages((prev) =>
        prev.map((m) =>
          m._id === message._id
            ? { ...m, reactions: { ...m.reactions, [userId]: reaction } }
            : m
        )
      );
    } catch (error) {
      console.error("Error reacting to message:", error);
      Alert.alert("Error", "Failed to react to message");
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    setIsLoading(true);
    Keyboard.dismiss();

    try {
      // One call now persists the message and notifies the other members. It
      // previously wrote to Firestore first, then told the API about the id.
      const { data } = await api.post("/api/groupchats/send", {
        groupId,
        text: newMessage,
      });

      setMessages((prev) => [...prev, data]);
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleModal = () => {
    setModalVisible(!isModalVisible);
  };

  const renderMessageItem = ({ item }) => {
    const isSender = String(item.sender?._id ?? item.sender) === String(userId);
    return (
      <MessageItemComponent
        message={item}
        isSender={isSender}
        onReply={handleReply}
        onDelete={handleDelete}
        onReact={(reaction) => handleReact(item, reaction)}
        onCopy={() => copyMessageToClipboard(item.contentText)}
      />
    );
  };

  const renderPetItem = ({ item }) => (
    <TouchableOpacity onPress={() => handlePetSelect(item)}>
      <UserPetCard data={item} type="pet" navigation={navigation} />
    </TouchableOpacity>
  );

  const filteredData =
    searchType === "messages"
      ? messages.filter((message) =>
          message.text.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : pets.filter((pet) =>
          pet.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

  return (
    <View style={tailwind("flex-1")}>
      <View style={styles.header}>
        <TouchableOpacity onPress={toggleSearch}>
          <Icon name="search" size={20} color={tokens.primary} />
        </TouchableOpacity>
        {isSearchEnabled && (
          <>
            <TextInput
              style={tailwind("border border-border p-2 rounded mx-4 my-2")}
              placeholder={
                searchType === "messages"
                  ? "Search messages..."
                  : "Search pets..."
              }
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity
              onPress={() =>
                setSearchType(searchType === "messages" ? "pets" : "messages")
              }
            >
              <Text style={tailwind("text-lg")}>
                {searchType === "messages" ? "Search Pets" : "Search Messages"}
              </Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity onPress={fetchGroupInfo}>
          <Icon name="refresh" size={20} color={tokens.primary} />
        </TouchableOpacity>
        <Image
          source={{ uri: groupInfo?.groupImage }}
          style={styles.groupImage}
        />
        <Text style={tailwind("text-lg font-bold")}>{groupInfo?.groupName}</Text>
        <Text style={tailwind("text-sm")}>
          {groupInfo?.participants?.length ?? 0} Members
        </Text>

        <TouchableOpacity
          onPress={() =>
            navigation.navigate("ChatDetails", { chatId: groupId, isGroupChat: true })
          }
        >
          <Icon name="info-circle" size={20} color={tokens.primary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={toggleModal}>
          <Icon name="ellipsis-v" size={20} color={tokens.primary} />
        </TouchableOpacity>

        <GroupOptionsModal
          isVisible={isModalVisible}
          onClose={toggleModal}
          navigation={navigation}
          groupId={groupId}
        />
      </View>

      <FlatList
        ref={flatListRef}
        data={filteredData}
        keyExtractor={(item) => item.id}
        renderItem={
          searchType === "messages" ? renderMessageItem : renderPetItem
        }
        style={tailwind("flex-1")}
      />
      <View
        style={tailwind("flex-row items-center p-2 border-t border-border")}
      >
        {replyTo && (
          <View style={styles.replyContainer}>
            <Text style={styles.replyText}>{replyTo}</Text>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Icon name="times-circle" size={12} color={tokens.text} />
            </TouchableOpacity>
          </View>
        )}
        <TextInput
          ref={messageInputRef}
          style={tailwind("flex-1 border border-border p-2 rounded mr-2")}
          placeholder="Type your message..."
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
    justifyContent: "space-between",
  },
  groupImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  searchBar: {
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    margin: 5,
  },
  replyContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
    backgroundColor: t.surfaceAlt,
    borderRadius: 15,
  },
  replyText: {
    fontSize: 12,
    color: t.text,
    marginRight: 8,
  },
  // Add styles for additional group info or icons here
});

export default GroupChatScreen;
