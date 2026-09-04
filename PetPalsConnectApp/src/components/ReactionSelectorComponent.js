// ReactionSelectorComponent.js
import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTokens } from "../context/AppThemeContext";

// These are already Unicode emoji, so react-native-emoji (which maps :shortcodes:
// to characters) was never doing anything here and is no longer a dependency.
const reactions = ["😀", "😍", "😢", "😡", "👍", "👎"];

const ReactionSelectorComponent = ({ onReact }) => {
  const tokens = useTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

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

const makeStyles = (t) => StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 10,
    backgroundColor: t.surface,
    borderRadius: 20,
    shadowColor: t.text,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  emojiButton: {
    padding: 5,
  },
  emoji: {
    color: t.text,
    fontSize: 24,
  },
});

export default ReactionSelectorComponent;
