// CustomTooltip.js
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

const CustomTooltip = ({ handleNext, handlePrev, handleStop, currentStep }) => {
  return (
    <View style={styles.tooltipContainer}>
      <Text style={styles.tooltipText}>{currentStep.text}</Text>

      {/* Step navigation buttons */}
      {handlePrev ? (
        <TouchableOpacity onPress={handlePrev} style={styles.navButton}>
          <Text style={styles.buttonText}>Prev</Text>
        </TouchableOpacity>
      ) : null}
      {handleNext ? (
        <TouchableOpacity onPress={handleNext} style={styles.navButton}>
          <Text style={styles.buttonText}>Next</Text>
        </TouchableOpacity>
      ) : null}

      {/* Skip button */}
      <TouchableOpacity onPress={handleStop} style={styles.skipButton}>
        <Text style={styles.buttonText}>Skip</Text>
      </TouchableOpacity>
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
