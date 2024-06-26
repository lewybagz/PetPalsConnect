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
import MessageItemComponent from "../../components/MessageItemComponent";
import { firestore } from "../../firebase/firebaseConfig";
import { useSelector, useDispatch } from "react-redux";
import { FieldValue } from "firebase/firestore";
import LoadingScreen from "../../components/LoadingScreenComponent";
import ChatOptionsModal from "../../components/ChatOptionsModal";
import Icon from "react-native-vector-icons/FontAwesome";
import Clipboard from "@react-native-community/clipboard";
import { getStoredToken } from "../../../utils/tokenutil";
import { clearError } from "../../redux/actions";
import { startLoading, endLoading, setError } from "../../redux/actions";
import { useSocketNotification } from "../../hooks/useSocketNotification";
import axios from "axios";

const ChatScreen = ({ route, navigation }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isModalVisible, setModalVisible] = useState(false);
  const [chatId, setChatId] = useState(null);
  const petInfo = route.params.pet;
  const flatListRef = useRef(null);
  const dispatch = useDispatch();
  const tailwind = useTailwind();

  const userId = useSelector((state) => state.userReducer.userId);
  const isLoading = useSelector((state) => state.chatReducer.isLoading);
  const error = useSelector((state) => state.chatReducer.error);

  useSocketNotification((newMessage) => {
    setMessages((prevMessages) => [...prevMessages, newMessage]);
  });

  if (isLoading) {
    return <LoadingScreen />;
  }

  useEffect(() => {
    if (error) {
      Alert.alert("Chat Error", error, [
        { text: "OK", onPress: () => dispatch(clearError()) },
      ]);
    }
  }, [error, dispatch]);

  const initiateChat = async () => {
    try {
      const token = await getStoredToken();
      const petId = petInfo.id;

      const response = await fetch("/api/chat/findOrCreate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, petId }),
      });

      const chat = await response.json();
      setChatId(chat._id);
    } catch (error) {
      console.error("Error initiating chat:", error);
      Alert.alert("Error", "Failed to initiate chat");
    }
  };

  useEffect(() => {
    initiateChat();
    const unsubscribe = firestore
      .collection("chats")
      .doc(petInfo.id)
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
  }, []);

  const toggleModal = () => {
    setModalVisible(!isModalVisible);
  };

  const handleSendMessage = async () => {
    const currentUser = useSelector((state) => state.userReducer.user);
    if (!newMessage.trim()) return;
    dispatch(startLoading());
    Keyboard.dismiss();

    try {
      const messageData = {
        text: newMessage,
        senderId: userId,
        petId: petInfo.id,
        timestamp: FieldValue.serverTimestamp(),
      };

      // Save the message to Firestore
      const messageRef = await firestore
        .collection("chats")
        .doc(petInfo.id)
        .collection("messages")
        .add(messageData);

      const senderName = currentUser.displayName;

      const token = await getStoredToken();
      // Call your API to handle any additional logic such as notifications
      await axios.post(
        "/api/chats/send", // Assuming you have a similar endpoint for individual chats
        {
          chatId: petInfo.id,
          senderId: userId,
          messageId: messageRef.id,
          senderName: senderName, // Include this if you need to send the sender's name
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setNewMessage("");
      Alert.alert("Success", "Message sent successfully.");
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message");
      dispatch(setError("Error sending message"));
    } finally {
      dispatch(endLoading());
    }
  };

  const handleReact = (message, reaction) => {
    try {
      // Update the message in Firestore with the reaction
      const reactionUpdate = {
        ...message.reactions,
        [userId]: reaction,
      };

      firestore
        .collection("chats") // Use the correct collection for 1-on-1 chats
        .doc(chatId) // Replace with the correct chat ID
        .collection("messages")
        .doc(message.id)
        .update({ reactions: reactionUpdate });

      // Update local state to reflect the reaction
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

  const handleDelete = async (message) => {
    try {
      // Assuming 'message.id' is the document ID of the message in Firestore
      await firestore
        .collection("chats") // Use the correct collection for 1-on-1 chats
        .doc(chatId) // Replace with the correct chat ID
        .collection("messages")
        .doc(message.id)
        .delete();

      // Update local state to remove the message
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg.id !== message.id)
      );

      Alert.alert("Message Deleted");
    } catch (error) {
      console.error("Error deleting message:", error);
      Alert.alert("Error", "Failed to delete message");
    }
  };

  const copyMessageToClipboard = async (messageText) => {
    Clipboard.setString(messageText);
    // Optionally, you can display an alert or toast to inform the user that the text has been copied.
    Alert.alert("Copied to Clipboard", messageText);
  };

  const renderMessageItem = ({ item }) => {
    const isSender = item.senderId === userId;
    return (
      <MessageItemComponent
        message={item}
        isSender={isSender}
        onDelete={handleDelete}
        onReact={(reaction) => handleReact(item, reaction)}
        onCopy={() => copyMessageToClipboard(item.ContentText)}
      />
    );
  };

  // Automatically scroll to the newest message
  useEffect(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  return (
    <View style={tailwind("flex-1")}>
      {/* this is how they are displayed in chat */}
      <View style={styles.header}>
        <Image source={{ uri: petInfo.photo }} style={styles.petImage} />
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
        keyExtractor={(item) => item.id}
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
