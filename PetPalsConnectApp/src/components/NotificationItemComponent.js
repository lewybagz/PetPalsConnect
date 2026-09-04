import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
} from "react-native";
import { useTailwind } from "../styles/tailwind";
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { getStoredToken } from "../../utils/tokenutil";
import api from "../api/axios";
import { useTokens } from "../context/AppThemeContext";
const NotificationItem = ({ content, navigation }) => {
  const tokens = useTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const [modalVisible, setModalVisible] = useState(false);
  const tailwind = useTailwind();
  // Hooks must be called at the top level of the component, never inside a
  // handler - React tracks them positionally.
  const userId = useSelector((state) => state.user.userId);

  const handleMuteNotifications = async () => {
    try {
      const token = await getStoredToken();

      const updatedPreferences = {
        notificationPreferences: {
          petPalsMapUpdates: false,
          playdateReminders: false,
          appUpdates: false,
          pushNotificationsEnabled: false,
          emailNotificationsEnabled: false,
        },
      };

      await api.patch(`/api/userpreferences/${userId}`, updatedPreferences, {
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

const makeStyles = (t) => StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalView: {
    margin: 20,
    backgroundColor: t.surface,
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: t.text,
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
    borderBottomColor: t.border,
  },
  optionText: {
    color: t.text,
    fontSize: 16,
  },
});

export default NotificationItem;
