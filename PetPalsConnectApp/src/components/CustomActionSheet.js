// CustomActionSheet.js
import React from "react";
import { Modal, View, TouchableOpacity, Text, StyleSheet } from "react-native";

const CustomActionSheet = ({ visible, onClose, onActionPress }) => {
  const actions = ["Reply", "React", "Copy", "Delete", "Cancel"];

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.container} onPress={onClose}>
        <View style={styles.actionSheet}>
          {actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={styles.actionItem}
              onPress={() => onActionPress(action.toLowerCase())}
            >
              <Text style={styles.actionText}>{action}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  actionSheet: {
    backgroundColor: "white",
    paddingVertical: 10,
  },
  actionItem: {
    padding: 15,
    alignItems: "center",
  },
  actionText: {
    fontSize: 18,
  },
});

export default CustomActionSheet;
