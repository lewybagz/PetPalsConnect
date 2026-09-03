import React, { useState, useEffect, useRef } from "react";
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
import { auth } from "../../../firebase/firebaseConfig";
import { FontAwesome as Icon } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { getStoredToken } from "../../../utils/tokenutil";
import { useSocketNotification } from "../../hooks/useSocketNotification";
import api from "../../api/axios";
import { useSelector } from "react-redux";

const GroupChatScreen = ({ route, navigation }) => {
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
  const [groupInfo, setGroupInfo] = useState(route.params.group);
  const flatListRef = useRef(null);
  const userId = useSelector((state) => state.user.userId);
  const tailwind = useTailwind();

  // Setting up the socket to handle real-time group chat messages
  useSocketNotification((newMessage) => {
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
      const { data } = await api.get(`/api/groupchats/${groupInfo.id}/messages`);
      setMessages(data);
    } catch (error) {
      console.warn("[groupchat] Could not load messages:", error.message);
      Alert.alert("Error", "Failed to load messages");
    }
  };

  const fetchPetsData = async (groupId) => {
    try {
      const token = await getStoredToken();
      const response = await fetch(`/api/groupchats/${groupId}/pets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const petsData = await response.json();
      setPets(petsData);
    } catch (error) {
      console.error("Error fetching pets data:", error);
      Alert.alert("Error", "Failed to load pets data");
    }
  };
  const fetchGroupInfo = async () => {
    try {
      const token = await getStoredToken();
      const response = await fetch(`api/groupchats/${route.params.group.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const updatedGroupInfo = await response.json();
      setGroupInfo(updatedGroupInfo);
    } catch (error) {
      console.error("Error fetching group info:", error);
    }
  };

  useEffect(() => {
    if (groupInfo.id) {
      fetchGroupInfo();
      fetchPetsData(groupInfo.id);
      loadMessages();
    }
  }, [groupInfo.id]);



  const copyMessageToClipboard = async (messageText) => {
    await Clipboard.setStringAsync(messageText);
    Alert.alert("Copied to Clipboard", messageText);
  };

  const handlePetSelect = (pet) => {
    console.log("Selected Pet:", pet.name);
    navigation.navigate("PetDetails", { petId: pet.id });
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
        `/api/groupchats/${groupInfo.id}/messages/${message._id}`
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
        groupId: groupInfo.id,
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
        groupId: groupInfo.id,
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
        onCopy={() => copyMessageToClipboard(item.ContentText)}
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
          <Icon name="search" size={20} color="#007bff" />
        </TouchableOpacity>
        {isSearchEnabled && (
          <>
            <TextInput
              style={tailwind("border border-gray-300 p-2 rounded mx-4 my-2")}
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
          <Icon name="refresh" size={20} color="#007bff" />
        </TouchableOpacity>
        <Image
          source={{ uri: groupInfo.groupImage }}
          style={styles.groupImage}
        />
        <Text style={tailwind("text-lg font-bold")}>{groupInfo.groupName}</Text>
        <Text style={tailwind("text-sm")}>
          {groupInfo.participantCount} Members
        </Text>

        <TouchableOpacity
          onPress={() =>
            navigation.navigate("GroupInfo", { groupId: groupInfo.id })
          }
        >
          <Icon name="info-circle" size={20} color="#007bff" />
        </TouchableOpacity>

        <TouchableOpacity onPress={toggleModal}>
          <Icon name="ellipsis-v" size={20} color="#007bff" />
        </TouchableOpacity>

        <GroupOptionsModal
          isVisible={isModalVisible}
          onClose={toggleModal}
          navigation={navigation}
          groupId={groupInfo.id}
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
        style={tailwind("flex-row items-center p-2 border-t border-gray-300")}
      >
        {replyTo && (
          <View style={styles.replyContainer}>
            <Text style={styles.replyText}>{replyTo}</Text>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Icon name="times-circle" size={12} color="#000" />
            </TouchableOpacity>
          </View>
        )}
        <TextInput
          ref={messageInputRef}
          style={tailwind("flex-1 border border-gray-300 p-2 rounded mr-2")}
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
    justifyContent: "space-between",
  },
  groupImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  searchBar: {
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    margin: 5,
  },
  replyContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
    backgroundColor: "#ececec",
    borderRadius: 15,
  },
  replyText: {
    fontSize: 12,
    color: "#333",
    marginRight: 8,
  },
  // Add styles for additional group info or icons here
});

export default GroupChatScreen;
