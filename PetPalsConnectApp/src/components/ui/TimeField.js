import React, { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { useTailwind } from "../../styles/tailwind";
import { hit } from "../../styles/tokens";
import Text from "./Text";

/**
 * A time of day, with no date attached.
 *
 * Quiet hours are "22:00 to 07:00" - a wall-clock window that repeats, not two
 * instants. Storing an instant would make the window drift across a time zone
 * change and would be wrong for exactly the person it is meant to help: the one
 * who has just landed somewhere else and would like to sleep.
 *
 * So the value in and out is `"HH:MM"`, and the `Date` the native picker
 * insists on is built for the length of the interaction and thrown away. Only
 * its hours and minutes are read.
 */

/** `"22:00"` as a Date today, which is the only shape the picker accepts. */
const toDate = (time) => {
  const [hours, minutes] = String(time ?? "22:00").split(":");
  const date = new Date();
  date.setHours(Number(hours) || 0, Number(minutes) || 0, 0, 0);
  return date;
};

const toTime = (date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const TimeField = ({ value, onChange, disabled = false, accessibilityLabel, testID }) => {
  const tailwind = useTailwind();
  const [open, setOpen] = useState(false);

  const handle = (event, selected) => {
    // Android's picker is a dialog that dismisses itself; iOS's is inline and
    // stays until the field is tapped again.
    setOpen(Platform.OS === "ios");
    if (event?.type === "dismissed" || !selected) return;
    onChange(toTime(selected));
  };

  return (
    <View>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: value }}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [
          tailwind(
            "px-md justify-center rounded-control border border-borderStrong bg-surfaceAlt"
          ),
          { minHeight: hit.min, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
        ]}
      >
        <Text variant="body" align="center">
          {value}
        </Text>
      </Pressable>

      {open ? (
        <DateTimePicker
          testID={testID ? `${testID}-picker` : undefined}
          value={toDate(value)}
          mode="time"
          is24Hour
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handle}
        />
      ) : null}
    </View>
  );
};

export { toDate, toTime };

export default TimeField;
