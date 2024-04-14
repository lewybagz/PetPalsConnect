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
import { useTailwind } from "nativewind";
import UserPetCard from "../../components/UserPetCardComponent";
import LoadingScreen from "../../components/LoadingScreenComponent";
import GroupOptionsModal from "../../components/GroupOptionsModal";
import MessageItemComponent from "../../components/MessageItemComponent";
import { auth, firestore } from "../../firebase/firebaseConfig";
import { FieldValue } from "firebase/firestore";
import Icon from "react-native-vector-icons/FontAwesome";
import Clipboard from "@react-native-community/clipboard";
import { getStoredToken } from "../../../utils/tokenutil";
import { useSocketNotification } from "../../hooks/useSocketNotification";
import axios from "axios";
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
  const userId = useSelector((state) => state.user.id);
  const currentUser = auth.currentUser;
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

  useEffect(() => {
    if (groupInfo.id) {
      fetchGroupInfo();
      fetchPetsData(groupInfo.id);
      const unsubscribe = firestore
        .collection("groupChats")
        .doc(groupInfo.id)
        .collection("messages")
        .orderBy("timestamp", "asc")
        .onSnapshot(
          (snapshot) => {
            const messagesData = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            setMessages(messagesData);
          },
          (error) => {
            Alert.alert("Error", "Failed to load messages");
            console.error("Firestore subscription error:", error);
          }
        );

      return unsubscribe;
    }
  }, [groupInfo.id]);

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

  const copyMessageToClipboard = async (messageText) => {
    Clipboard.setString(messageText);
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
      await firestore
        .collection("groupChats")
        .doc(groupInfo.id)
        .collection("messages")
        .doc(message.id)
        .delete();

      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg.id !== message.id)
      );

      Alert.alert("Message Deleted");
    } catch (error) {
      console.error("Error deleting message:", error);
      Alert.alert("Error", "Failed to delete message");
    }
  };

  const handleReact = async (message, reaction) => {
    try {
      const reactionUpdate = {
        ...message.reactions,
        [auth.currentUser.uid]: reaction,
      };

      // Update the reactions in the Firestore
      await firestore
        .collection("groupChats")
        .doc(groupInfo.id)
        .collection("messages")
        .doc(message.id)
        .update({ reactions: reactionUpdate });

      // Call the backend to handle sending notifications
      const response = await axios.post(
        "/api/groupchats/react",
        {
          groupId: groupInfo.id,
          messageId: message.id,
          reactorId: auth.currentUser.uid,
          reaction: reaction,
        },
        {
          headers: { Authorization: `Bearer ${await getStoredToken()}` },
        }
      );

      if (response.status === 200) {
        console.log("Reaction notification sent successfully");
      }

      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === message.id ? { ...msg, reactions: reactionUpdate } : msg
        )
      );
    } catch (error) {
      console.error("Error reacting to message:", error);
      Alert.alert("Error", "Failed to react to message");
    }
  };

  const saveMessageToDatabase = async (groupId, messageData) => {
    try {
      const messageRef = await firestore
        .collection("groupChats")
        .doc(groupId)
        .collection("messages")
        .add(messageData);
      console.log("Message saved to database:", messageRef.id);
      return messageRef;
    } catch (error) {
      console.error("Error saving message to database:", error);
      throw error;
    }
  };

  const handleSendMessage = async (groupId) => {
    if (!newMessage.trim()) return;
    setIsLoading(true);
    Keyboard.dismiss();

    try {
      const messageData = {
        text: newMessage,
        senderId: userId,
        groupId: groupInfo.id,
        timestamp: FieldValue.serverTimestamp(),
      };

      const savedMessage = await saveMessageToDatabase(groupId, messageData);

      const token = await getStoredToken();
      await axios.post(
        "/api/groupChats/notifyGroupMembers",
        {
          groupId: groupInfo.id,
          senderId: userId,
          senderName: currentUser.displayName,
          messageId: savedMessage.id,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setNewMessage("");
      Alert.alert("Success", "Message sent and notifications dispatched.");
    } catch (error) {
      console.error("Error sending message or notifying members:", error);
      Alert.alert("Error", "Failed to send message or notify members");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleModal = () => {
    setModalVisible(!isModalVisible);
  };

  const renderMessageItem = ({ item }) => {
    const isSender = item.senderId === auth.currentUser.uid;
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
