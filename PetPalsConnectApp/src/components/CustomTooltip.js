// CustomTooltip.js
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import AnimatedButton from "./AnimatedButton";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const CustomTooltip = ({ handleNext, handlePrev, handleStop, currentStep }) => {
  return (
    <View style={styles.tooltipContainer}>
      <Text style={styles.tooltipText}>{currentStep.text}</Text>

      {handlePrev ? (
        <AnimatedButton
          onPress={handlePrev}
          buttonStyle={styles.navButton}
          icon={<Icon name="arrow-left" size={20} color="white" />} // Example icon
          text="Prev"
          textStyle={styles.buttonText}
        />
      ) : null}
      {handleNext ? (
        <AnimatedButton
          onPress={handleNext}
          buttonStyle={styles.navButton}
          icon={<Icon name="arrow-right" size={20} color="white" />} // Example icon
          text="Next"
          textStyle={styles.buttonText}
        />
      ) : null}

      {/* Skip button */}
      <AnimatedButton
        onPress={handleStop}
        buttonStyle={styles.skipButton}
        text="Skip"
        textStyle={styles.buttonText}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  tooltipContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#ffffff",
    borderRadius: 5,
  },
  tooltipText: {
    marginBottom: 5,
  },
  navButton: {
    padding: 5,
    marginHorizontal: 5,
  },
  skipButton: {
    padding: 5,
    marginTop: 5,
  },
  buttonText: {
    color: "#007bff",
  },
});

export default CustomTooltip;
