import React from "react";
import { View } from "react-native";

import { Button, Card, Text } from "./ui";
import { useTailwind } from "../styles/tailwind";

/**
 * What the walkthrough says at each step.
 *
 * Rebuilt on the design system. The old one used `AnimatedButton` - which had
 * padding on an outer `Animated.View` and `onPress` on a child with none, so
 * taps in the visible area did nothing - and passed `color="white"` to its
 * icons, a literal that follows no theme and would be invisible on the light
 * surface it sits on. It also offered "Prev", "Next" and "Skip" as three
 * equally-weighted buttons, which is three decisions where there is one.
 *
 * There is one primary action now, and it says what it does: "Next" while
 * there are steps left, "Got it" on the last one.
 */
const CustomTooltip = ({
  currentStep,
  stepNumber,
  stepCount,
  handleNext,
  handlePrev,
  handleStop,
  isLast,
}) => {
  const tailwind = useTailwind();

  return (
    <Card testID="walkthrough-tooltip-card">
      {stepCount > 1 ? (
        <Text variant="caption" tone="muted" style={tailwind("mb-xs")}>
          {`Step ${stepNumber} of ${stepCount}`}
        </Text>
      ) : null}

      <Text variant="body">{currentStep?.text}</Text>

      <View style={tailwind("flex-row items-center mt-lg")}>
        {handlePrev ? (
          <Button
            testID="walkthrough-prev"
            title="Back"
            variant="ghost"
            fullWidth={false}
            onPress={handlePrev}
            style={tailwind("mr-sm")}
          />
        ) : null}

        <View style={tailwind("flex-1")} />

        <Button
          testID="walkthrough-skip"
          // "Skip" on the last step would be a lie: there is nothing left to
          // skip, and the tour is over either way.
          title={isLast ? "" : "Skip"}
          variant="ghost"
          fullWidth={false}
          onPress={handleStop}
          style={[tailwind("mr-sm"), isLast ? { display: "none" } : null]}
        />

        <Button
          testID="walkthrough-next"
          title={isLast ? "Got it" : "Next"}
          fullWidth={false}
          onPress={isLast ? handleStop : handleNext}
        />
      </View>
    </Card>
  );
};

export default CustomTooltip;
