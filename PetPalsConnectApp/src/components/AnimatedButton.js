import React, { useRef } from "react";
import { TouchableOpacity, Text, Animated, StyleSheet } from "react-native";

const AnimatedButton = ({ text, onPress, buttonStyle, textStyle }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const animateButton = (isPressIn) => {
    Animated.spring(scale, {
      toValue: isPressIn ? 0.95 : 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[styles.button, buttonStyle, { transform: [{ scale }] }]}
      onTouchStart={() => animateButton(true)}
      onTouchEnd={() => animateButton(false)}
    >
      <TouchableOpacity onPress={onPress}>
        <Text style={[styles.text, textStyle]}>{text}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007bff", // Default color
  },
  text: {
    color: "white",
    fontSize: 16,
  },
});

export default AnimatedButton;
