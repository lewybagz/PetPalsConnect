import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTailwind } from "nativewind";
import axios from "axios";
import { useSelector } from "react-redux";
import { getStoredToken } from "../../utils/tokenutil";

const ChatOptionsModal = ({ isVisible, onClose, navigation }) => {
  const tailwind = useTailwind();

  // Access user ID and chat ID from Redux store
  const userId = useSelector((state) => state.user.userId);
  const chatId = useSelector((state) => state.chat.chatId);

  const handleMuteNotifications = async () => {
    console.log("Mute Tapped");
    try {
      const token = await getStoredToken();
      const response = await axios.post(
        "/api/groupchats/toggle-mute",
        {
          userId: userId,
          chatId: chatId,
          mute: true,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      console.log(response.data.message);
    } catch (error) {
      console.error("Error updating mute settings:", error);
    }
    onClose();
  };

  const handleViewMedia = async () => {
    console.log("View Media Tapped");
    try {
      const token = await getStoredToken(); // Retrieve the token
      const response = await axios.get(`/api/chats/${chatId}/media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const mediaArray = response.data.media;
      if (mediaArray.length > 0) {
        navigation.navigate("MediaViewScreen", { mediaItems: mediaArray });
      } else {
        console.log("No media available for this chat.");
      }
    } catch (error) {
      console.error("Error fetching media:", error);
    }
    onClose();
  };

  return (
    <Modal visible={isVisible} animationType="slide" transparent>
      <View style={tailwind("flex-1 justify-end bg-opacity-50 bg-black")}>
        <View style={tailwind("bg-white p-4 rounded-t-3xl")}>
          {/* Mute Notifications */}
          <TouchableOpacity
            style={styles.option}
            onPress={handleMuteNotifications}
          >
            <Text style={tailwind("text-lg text-center")}>
              Mute Notifications
            </Text>
          </TouchableOpacity>

          {/* View Media */}
          <TouchableOpacity style={styles.option} onPress={handleViewMedia}>
            <Text style={tailwind("text-lg text-center")}>View Media</Text>
          </TouchableOpacity>

          {/* Cancel */}
          <TouchableOpacity style={styles.cancelOption} onPress={onClose}>
            <Text style={tailwind("text-lg text-center")}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Semi-transparent background
  },
  modalContent: {
    backgroundColor: "white",
    padding: 16,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  option: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  optionText: {
    fontSize: 18,
    textAlign: "center",
    color: "#333",
  },
  leaveGroup: {
    borderBottomWidth: 0, // Remove border for the last option
  },
  leaveGroupText: {
    color: "#ff3b30", // Red color for critical actions
  },
  cancelOption: {
    paddingVertical: 12,
  },
});

export default ChatOptionsModal;
