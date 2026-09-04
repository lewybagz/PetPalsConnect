import React, { useState } from "react";
import { Alert, Modal, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTailwind } from "../styles/tailwind";
import { blockUser } from "../api/safety";

/**
 * The "…" that every screen showing another person needs.
 *
 * Block and report existed in exactly two places - an unused card component and
 * a swipe card - and in neither of the two screens where somebody actually
 * meets a stranger: Discover and Chat. Being able to report a person only from
 * a screen you reach by already liking them is not a safety feature.
 *
 * `userId` is the person, not the pet. Everything here is about the owner: you
 * do not block a dog.
 */
const SafetyMenu = ({
  userId,
  name,
  navigation,
  onBlocked,
  testID = "safety-menu",
  tint = "#6b7280",
  extraOptions = [],
}) => {
  const tailwind = useTailwind();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const who = name ?? "this person";

  const confirmBlock = () => {
    setOpen(false);
    Alert.alert(
      `Block ${who}?`,
      "They won't appear in your matches or search, and neither of you will be able to message the other.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await blockUser(userId);
              onBlocked?.(userId);
            } catch (error) {
              Alert.alert(
                "Error",
                error.response?.data?.message ?? "Could not block them."
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const report = () => {
    setOpen(false);
    navigation?.navigate("ReportUser", { userId, name });
  };

  if (!userId) return null;

  return (
    <>
      <TouchableOpacity
        testID={testID}
        accessibilityLabel={`Safety options for ${who}`}
        disabled={busy}
        onPress={() => setOpen(true)}
        style={tailwind("p-2")}
      >
        <Ionicons name="ellipsis-horizontal" size={22} color={tint} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide">
        <TouchableOpacity
          testID={`${testID}-backdrop`}
          activeOpacity={1}
          onPress={() => setOpen(false)}
          style={tailwind("flex-1 justify-end bg-black bg-opacity-50")}
        >
          <View style={tailwind("bg-white rounded-t-3xl p-4 pb-8")}>
            {extraOptions.map((option) => (
              <TouchableOpacity
                key={option.label}
                testID={option.testID}
                onPress={() => {
                  setOpen(false);
                  option.onPress();
                }}
                style={tailwind("py-4 border-b border-gray-100")}
              >
                <Text style={tailwind("text-lg text-center")}>{option.label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              testID={`${testID}-report`}
              onPress={report}
              style={tailwind("py-4 border-b border-gray-100")}
            >
              <Text style={tailwind("text-lg text-center text-red-600")}>
                Report {who}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID={`${testID}-block`}
              onPress={confirmBlock}
              style={tailwind("py-4 border-b border-gray-100")}
            >
              <Text style={tailwind("text-lg text-center text-red-600")}>
                Block {who}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID={`${testID}-cancel`}
              onPress={() => setOpen(false)}
              style={tailwind("py-4")}
            >
              <Text style={tailwind("text-lg text-center text-gray-500")}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

export default SafetyMenu;
