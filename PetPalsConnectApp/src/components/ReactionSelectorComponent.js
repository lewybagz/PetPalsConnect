// ReactionSelectorComponent.js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

// These are already Unicode emoji, so react-native-emoji (which maps :shortcodes:
// to characters) was never doing anything here and is no longer a dependency.
const reactions = ["😀", "😍", "😢", "😡", "👍", "👎"];

const ReactionSelectorComponent = ({ onReact }) => {
  return (
    <View style={styles.container}>
      {reactions.map((reaction, index) => (
        <TouchableOpacity
          key={index}
          onPress={() => onReact(reaction)}
          style={styles.emojiButton}
        >
          <Text style={styles.emoji}>{reaction}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 10,
    backgroundColor: "white",
    borderRadius: 20,
    shadowColor: "black",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  emojiButton: {
    padding: 5,
  },
  emoji: {
    fontSize: 24,
  },
});

export default ReactionSelectorComponent;
