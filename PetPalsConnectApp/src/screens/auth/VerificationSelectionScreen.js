import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { useTailwind } from "nativewind";

const VerificationSelectionScreen = ({ navigation, route }) => {
  const tailwind = useTailwind();
  const { email } = route.params; // Assumed passed from previous screen
  const scaleAnim = new Animated.Value(1); // Initial scale value for button animation

  // Function to handle scale animation on press
  const animateScale = (newValue) => {
    Animated.spring(scaleAnim, {
      toValue: newValue,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={[styles.container, tailwind("justify-center items-center")]}>
      <Text style={[styles.title, tailwind("mb-4")]}>
        Choose Verification Method
      </Text>

      <AnimatedTouchableOpacity
        style={[
          styles.buttonContainer,
          tailwind("bg-blue-500 mb-2"),
          { transform: [{ scale: scaleAnim }] },
        ]}
        onPressIn={() => animateScale(0.95)} // Scales down the button
        onPressOut={() => animateScale(1)} // Scales up the button back to normal
        onPress={() => navigation.navigate("PhoneAuth")}
      >
        <Text style={[styles.buttonText, tailwind("text-white")]}>
          Verify by Phone
        </Text>
      </AnimatedTouchableOpacity>

      <AnimatedTouchableOpacity
        style={[styles.buttonContainer, tailwind("bg-green-500")]}
        onPressIn={() => animateScale(0.95)}
        onPressOut={() => animateScale(1)}
        onPress={() => navigation.navigate("EmailAuth", { email })}
      >
        <Text style={[styles.buttonText, tailwind("text-white")]}>
          Verify by Email
        </Text>
      </AnimatedTouchableOpacity>
    </View>
  );
};

// You can use Animated.createAnimatedComponent to make the TouchableOpacity animatable
const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    elevation: 3, // Only for Android shadow effect
  },
  buttonText: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "500",
  },
});

export default VerificationSelectionScreen;
