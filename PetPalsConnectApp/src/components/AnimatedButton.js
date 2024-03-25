import React, { useRef } from "react";
import {
  TouchableOpacity,
  Text,
  Animated,
  StyleSheet,
  ActivityIndicator,
  View,
} from "react-native";

const AnimatedButton = ({
  text,
  onPress,
  buttonStyle,
  textStyle,
  icon,
  isLoading,
  animationType = "spring",
  shape = "rectangle",
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current; // For rotate animation

  const animateButton = (isPressIn) => {
    const animationConfig = {
      toValue: isPressIn ? 0.95 : 1,
      useNativeDriver: true,
    };

    if (animationType === "spring") {
      Animated.spring(scale, { ...animationConfig, friction: 5 }).start();
    } else if (animationType === "linear") {
      Animated.timing(scale, { ...animationConfig, duration: 100 }).start();
    } else if (animationType === "pulse") {
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.05,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (animationType === "rotate") {
      Animated.spring(rotate, {
        toValue: isPressIn ? 1 : 0,
        tension: 150,
        useNativeDriver: true,
      }).start();
    }
  };

  return (
    <Animated.View
      style={[
        styles.button,
        buttonStyle,
        shapeStyles[shape],
        { transform: [{ scale }] },
      ]}
      onTouchStart={() => animateButton(true)}
      onTouchEnd={() => animateButton(false)}
    >
      <TouchableOpacity onPress={onPress} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator color={textStyle?.color || "white"} />
        ) : (
          <View style={styles.content}>
            {icon}
            {text && <Text style={[styles.text, textStyle]}>{text}</Text>}
          </View>
        )}
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
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});

const shapeStyles = StyleSheet.create({
  rectangle: {
    borderRadius: 5,
  },
  round: {
    borderRadius: 20,
  },
  circle: {
    borderRadius: 50,
  },
  // Add more shapes if needed
});

export default AnimatedButton;
