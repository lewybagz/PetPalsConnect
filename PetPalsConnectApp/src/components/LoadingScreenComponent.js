import React, { useState, useEffect } from "react";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import * as Progress from "react-native-progress";
import { useTokens } from "../context/AppThemeContext";

const petCareTips = [
  "Regular exams prevent health issues. Yearly vet visits are crucial for health screenings and vaccinations.",
  "Spay and neuter pets to reduce unwanted animals and health risks.",
  "Prevent parasites year-round with proper flea, worm, and heartworm control.",
  "Maintain a healthy pet weight to reduce risks of diabetes, arthritis, and cancer.",
  "Regular vaccinations against diseases like rabies and distemper are vital.",
  "Provide mental stimulation with walks, toys, and play time for a healthy environment.",
  "Microchip and tattoo pets for easy identification and to increase chances of reunion if lost.",
  "Regular dental care prevents gum disease, tooth loss, and pain in pets.",
  "Never give human medications to pets; they can cause serious health risks.",
  "Use proper restraint in vehicles, like carriers or special harnesses, for pet safety.",
];

const LoadingScreen = () => {
  const tokens = useTokens();
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((oldProgress) => {
        if (oldProgress < 1) {
          return oldProgress + 0.1;
        }
        return 0;
      });

      setCurrentTipIndex((oldIndex) => (oldIndex + 1) % petCareTips.length);
    }, 1900); // Change tip every 3 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      {/* A Lottie animation used to render here, but the referenced JSON file
          ("./path-to-lottie-animation.json") was a placeholder that was never
          added, so this screen crashed on import. Drop an animation into
          assets/ and swap this spinner for <LottieView /> when you have one. */}
      <ActivityIndicator size="large" style={styles.lottie} />
      <Text style={styles.tip}>{petCareTips[currentTipIndex]}</Text>
      <Progress.Bar
        progress={progress}
        width={null} // Take the full width of the container
        color={tokens.primary}
        style={styles.progressBar}
      />
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
  },
  lottie: {
    width: 200,
    height: 200,
  },
  tip: {
    fontSize: 16,
    textAlign: "center",
    margin: 20,
  },
  progressBar: {
    height: 20,
    marginTop: 20,
    width: "80%",
  },
});

export default LoadingScreen;
