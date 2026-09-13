import React from "react";
import { Modal, Pressable, View } from "react-native";

import { Button, Text } from "../../components/ui";
import { useTailwind } from "../../styles/tailwind";
import { radius, space } from "../../styles/tokens";

/**
 * The disclosure before the first message.
 *
 * Apple 5.1.1(i) wants explicit permission before personal data is shared
 * with a third-party AI, and Play's User Data policy says the same of
 * third-party integrations. This is the app's own sentence about what goes
 * where, in front of the choice, the way `services/location.js` puts one in
 * front of the OS prompt. "Continue" is an affirmative tap; backing out is
 * "Not now" and means no. The sheet is not dismissed by tapping away, because
 * a tap-away is not an answer.
 */
const SpotConsentSheet = ({ visible, onContinue, onNotNow, busy = false }) => {
  const tailwind = useTailwind();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onNotNow}>
      <View style={tailwind("flex-1 justify-end bg-scrim")}>
        <Pressable
          testID="spot-consent"
          onPress={() => {}}
          style={[
            tailwind("bg-surface px-lg pt-lg"),
            {
              borderTopLeftRadius: radius.card * 2,
              borderTopRightRadius: radius.card * 2,
              paddingBottom: space.xxl,
            },
          ]}
        >
          <Text variant="display">Meet Spot</Text>
          <Text tone="muted" style={tailwind("mt-sm")}>
            Spot answers questions about your pets and can update your records
            for you. To do that, PetPals sends what you type, any photo you
            attach, and your pets&apos; details - names, species, ages, weights
            and health records - to Anthropic, the company whose AI Spot runs on.
          </Text>
          <Text tone="muted" style={tailwind("mt-sm")}>
            Nothing you say to Spot is shown to other users. Anthropic keeps
            requests for up to 30 days and does not use them to train its
            models. Spot is not a veterinarian: it describes published guidance
            and always points you to a vet.
          </Text>
          <View style={tailwind("mt-lg")}>
            <Button title="Continue" onPress={onContinue} loading={busy} testID="spot-consent-continue" />
            <Button
              title="Not now"
              variant="ghost"
              onPress={onNotNow}
              disabled={busy}
              testID="spot-consent-not-now"
              style={tailwind("mt-xs")}
            />
          </View>
        </Pressable>
      </View>
    </Modal>
  );
};

export default SpotConsentSheet;
