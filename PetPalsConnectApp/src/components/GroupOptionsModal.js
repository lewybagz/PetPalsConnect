import React, { useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useTailwind } from "nativewind";
import axios from "axios";
import { getStoredToken } from "../../utils/tokenutil";
import { useSelector, useDispatch } from "react-redux";
import { clearError, setError } from "../redux/actions";
import LoadingScreen from "./LoadingScreenComponent";

const GroupOptionsModal = ({ isVisible, onClose, navigation }) => {
  const tailwind = useTailwind();
  const dispatch = useDispatch();
  // Access user ID and chat ID from Redux store
  const userId = useSelector((state) => state.userReducer.userId);
  const chatId = useSelector((state) => state.chatReducer.chatId);
  const error = useSelector((state) => state.chatReducer.error);
  const isLoading = useSelector((state) => state.chatReducer.isLoading);
  const getToken = async () => {
    try {
      const token = await getStoredToken();
      return token;
    } catch (err) {
      setError(err.message);
    }
  };
  // Handle error alert
  useEffect(() => {
    if (error) {
      Alert.alert("Error", error, [
        { text: "OK", onPress: () => dispatch(clearError()) },
      ]);
    }
  }, [error, dispatch]);

  if (isLoading) {
    return <LoadingScreen />;
  }
  const handleMuteNotifications = async (token) => {
    console.log("Mute Tapped");
    try {
      getToken();
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

  const handleViewMedia = async (token) => {
    console.log("View Media Tapped");
    try {
      getToken();
      const response = await axios.get(`/api/groupchats/${chatId}/media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const mediaArray = response.data.media;
      if (mediaArray.length > 0) {
        navigation.navigate("MediaView", { mediaItems: mediaArray });
      } else {
        console.log("No media available for this chat.");
      }
    } catch (error) {
      console.error("Error fetching media:", error);
    }
    onClose();
  };

  const handleLeaveGroup = async (token) => {
    console.log("Leave Group Tapped");
    try {
      getToken();
      await axios.post(
        "/api/groupchats/leave",
        {
          userId: userId,
          chatId: chatId,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      navigation.navigate("ChatsList");
    } catch (error) {
      console.error("Error leaving group chat:", error);
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

          {/* Leave Group */}
          <TouchableOpacity
            style={[styles.option, styles.leaveGroup]}
            onPress={handleLeaveGroup}
          >
            <Text style={tailwind("text-lg text-center text-red-500")}>
              Leave Group
            </Text>
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

export default GroupOptionsModal;
