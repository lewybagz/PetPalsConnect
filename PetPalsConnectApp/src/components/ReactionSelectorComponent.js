// ReactionSelectorComponent.js
import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import Emoji from "react-native-emoji";

const reactions = ["😀", "😍", "😢", "😡", "👍", "👎"]; // Define the set of emojis you want to use

const ReactionSelectorComponent = ({ onReact }) => {
  return (
    <View style={styles.container}>
      {reactions.map((reaction, index) => (
        <TouchableOpacity
          key={index}
          onPress={() => onReact(reaction)}
          style={styles.emojiButton}
        >
          <Emoji name={reaction} style={styles.emoji} />
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
