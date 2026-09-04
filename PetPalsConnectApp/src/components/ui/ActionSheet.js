import React from "react";
import { Modal, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Text from "./Text";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { hit, radius, space } from "../../styles/tokens";

/**
 * A sheet of choices, rising from the bottom.
 *
 * `ChatOptionsModal`, `GroupOptionsModal`, `SwipeableUserPetCard` and
 * `NotificationItemComponent` each carried their own copy: the same
 * `Modal`/scrim/rounded-top structure with a different `paddingVertical` and a
 * different idea of how tall a row should be. Two of the four had rows of 12pt
 * padding around a line of text, which is under the 44pt tap floor.
 *
 * Items are `{ label, onPress, tone, icon, disabled, testID }`. The sheet
 * closes itself before running an action, so a handler that navigates does not
 * leave a modal over the destination.
 */
const ActionSheet = ({ visible, onClose, title, items = [], testID = "action-sheet" }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();

  const run = (item) => {
    onClose?.();
    item.onPress?.();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        testID={`${testID}-scrim`}
        accessibilityLabel="Close"
        onPress={onClose}
        style={tailwind("flex-1 justify-end bg-scrim")}
      >
        {/* Swallows taps so pressing the sheet itself does not dismiss it. */}
        <Pressable
          testID={testID}
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
          {title ? (
            <Text variant="caption" tone="muted" align="center" style={tailwind("mb-sm")}>
              {title}
            </Text>
          ) : null}

          {items.map((item) => (
            <Pressable
              key={item.label}
              testID={item.testID}
              disabled={item.disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: Boolean(item.disabled) }}
              onPress={() => run(item)}
              style={({ pressed }) => [
                tailwind("flex-row items-center justify-center border-b border-border"),
                { minHeight: hit.min, opacity: item.disabled ? 0.5 : pressed ? 0.6 : 1 },
              ]}
            >
              {item.icon ? (
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={item.tone === "danger" ? tokens.danger : tokens.text}
                  style={{ marginRight: space.sm }}
                />
              ) : null}
              <Text variant="body" tone={item.tone === "danger" ? "danger" : "default"}>
                {item.label}
              </Text>
            </Pressable>
          ))}

          <Pressable
            testID={`${testID}-cancel`}
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              tailwind("items-center justify-center"),
              { minHeight: hit.min, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text variant="body" tone="muted">
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default ActionSheet;
