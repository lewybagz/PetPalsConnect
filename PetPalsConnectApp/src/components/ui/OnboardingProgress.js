import React from "react";
import { View } from "react-native";

import { useTailwind } from "../../styles/tailwind";
import Text from "./Text";

/**
 * Where you are in signing up.
 *
 * Onboarding is three writes that cannot be made atomic - the Firebase account,
 * the Mongo profile, the first pet - and `AuthSessionContext` reports them as
 * `signedOut -> needsProfile -> needsPet -> ready`. That is a good architecture
 * and it was completely invisible: each screen arrived with no indication that
 * it was one of three, or which one, so a person who was interrupted after the
 * second had no way to tell whether they had finished.
 *
 * Three dots and a count, not a percentage. The steps are discrete and there
 * are only three of them.
 */
export const ONBOARDING_STEPS = ["Account", "Profile", "Your pet"];

const OnboardingProgress = ({ step, testID = "onboarding-progress" }) => {
  const tailwind = useTailwind();
  const total = ONBOARDING_STEPS.length;
  const current = Math.min(Math.max(step, 1), total);

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${current} of ${total}: ${ONBOARDING_STEPS[current - 1]}`}
      accessibilityValue={{ min: 1, max: total, now: current }}
      style={tailwind("mb-xl")}
    >
      <View style={tailwind("flex-row mb-sm")}>
        {ONBOARDING_STEPS.map((label, index) => (
          <View
            key={label}
            testID={`${testID}-bar-${index + 1}`}
            // `surfaceAlt` is nearly the background in dark, so the steps you
            // have not reached vanished and the bar looked like it had two
            // segments. The unfilled track is a line, so it uses the line token.
            style={tailwind(
              `flex-1 h-1 rounded-pill ${index + 1 <= current ? "bg-primary" : "bg-border"} ${
                index === 0 ? "" : "ml-xs"
              }`
            )}
          />
        ))}
      </View>

      <Text variant="caption" tone="muted">
        Step {current} of {total} · {ONBOARDING_STEPS[current - 1]}
      </Text>
    </View>
  );
};

export default OnboardingProgress;
