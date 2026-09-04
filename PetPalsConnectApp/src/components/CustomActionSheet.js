// CustomActionSheet.js
import React, { useMemo } from "react";
import { Modal, View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { useTokens } from "../context/AppThemeContext";

const CustomActionSheet = ({ visible, onClose, onActionPress }) => {
  const tokens = useTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

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

const makeStyles = (t) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: t.scrim,
  },
  actionSheet: {
    backgroundColor: t.surface,
    paddingVertical: 10,
  },
  actionItem: {
    padding: 15,
    alignItems: "center",
  },
  actionText: {
    color: t.text,
    fontSize: 18,
  },
});

export default CustomActionSheet;
