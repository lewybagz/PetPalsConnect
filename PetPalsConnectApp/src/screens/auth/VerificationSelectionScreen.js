import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";

const VerificationSelectionScreen = ({ navigation, route }) => {
  const tokens = useTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const tailwind = useTailwind();
  // Guarded: route.params is undefined when opened without navigation params.
  const email = route.params?.email ?? "";
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
          tailwind("bg-primary mb-2"),
          { transform: [{ scale: scaleAnim }] },
        ]}
        onPressIn={() => animateScale(0.95)} // Scales down the button
        onPressOut={() => animateScale(1)} // Scales up the button back to normal
        onPress={() => navigation.navigate("PhoneAuth")}
      >
        <Text style={[styles.buttonText, tailwind("text-onPrimary")]}>
          Verify by Phone
        </Text>
      </AnimatedTouchableOpacity>

      <AnimatedTouchableOpacity
        style={[styles.buttonContainer, tailwind("bg-success")]}
        onPressIn={() => animateScale(0.95)}
        onPressOut={() => animateScale(1)}
        onPress={() => navigation.navigate("EmailAuth", { email })}
      >
        <Text style={[styles.buttonText, tailwind("text-onPrimary")]}>
          Verify by Email
        </Text>
      </AnimatedTouchableOpacity>
    </View>
  );
};

// You can use Animated.createAnimatedComponent to make the TouchableOpacity animatable
const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

const makeStyles = (t) => StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    color: t.text,
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
    color: t.onPrimary,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "500",
  },
});

export default VerificationSelectionScreen;
