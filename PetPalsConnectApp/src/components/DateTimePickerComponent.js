import React, { useState } from "react";
import {
  View,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Text,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

const DateTimePickerComponent = ({ date, onDateChange, mode }) => {
  const [showPicker, setShowPicker] = useState(false);

  const showDateTimePicker = () => {
    setShowPicker(true);
  };

  const onDateTimeChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowPicker(Platform.OS === "ios");
    onDateChange(currentDate);
  };

  return (
    <View style={styles.container}>
      {Platform.OS === "android" && (
        <TouchableOpacity style={styles.button} onPress={showDateTimePicker}>
          <Text style={styles.buttonText}>
            {mode === "date" ? "Select Date" : "Select Time"}
          </Text>
        </TouchableOpacity>
      )}

      {(showPicker || Platform.OS === "ios") && (
        <DateTimePicker
          value={date}
          mode={mode}
          is24Hour={true}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onDateTimeChange}
          style={styles.picker}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#d0d0d0",
    alignItems: "center",
    marginVertical: 10,
  },
  button: {
    backgroundColor: "#007bff",
    padding: 12,
    borderRadius: 6,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  picker: {
    width: "100%",
    backgroundColor: "white",
    color: "black", // For text color inside the picker
  },
  // Add more complex styles here as needed
});

export default DateTimePickerComponent;
