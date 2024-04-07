import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
} from "react-native";
import { useTailwind } from "nativewind";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useSelector } from "react-redux";
import { getStoredToken } from "../../utils/tokenutil";
import axios from "axios";
const NotificationItem = ({ content, navigation }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const tailwind = useTailwind();

  const handleMuteNotifications = async () => {
    try {
      const token = await getStoredToken();
      const userId = useSelector((state) => state.user.userId); // Assuming you're using Redux to store user ID

      const updatedPreferences = {
        notificationPreferences: {
          petPalsMapUpdates: false,
          playdateReminders: false,
          appUpdates: false,
          pushNotificationsEnabled: false,
          emailNotificationsEnabled: false,
        },
      };

      await axios.patch(`/api/userpreferences/${userId}`, updatedPreferences, {
        headers: { Authorization: `Bearer ${token}` },
      });

      Alert.alert("Notifications Muted", "All notifications have been muted.");
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      Alert.alert("Error", "Failed to update notification preferences.");
    }
  };

  return (
    <View style={tailwind("flex-row justify-between items-center p-2")}>
      <Text>{content}</Text>
      <TouchableOpacity onPress={() => setModalVisible(true)}>
        <Icon name="dots-vertical" size={20} />
      </TouchableOpacity>

      {/* Modal for options */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(!modalVisible);
        }}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            {/* Options */}
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => {
                setModalVisible(!modalVisible);
                navigation.navigate("NotificationPreferences");
              }}
            >
              <Text style={styles.optionText}>Notification Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => {
                setModalVisible(!modalVisible);
                handleMuteNotifications();
              }}
            >
              <Text style={styles.optionText}>Mute Notifications</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setModalVisible(!modalVisible)}
              style={styles.optionButton}
            >
              <Text style={styles.optionText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  optionButton: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  optionText: {
    fontSize: 16,
  },
});

export default NotificationItem;
