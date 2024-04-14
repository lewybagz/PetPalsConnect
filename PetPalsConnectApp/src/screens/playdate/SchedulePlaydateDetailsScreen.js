import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button, Alert, StyleSheet } from "react-native";
import axios from "axios";
import DateTimePickerComponent from "../components/DateTimePickerComponent";
import { clearError } from "../../redux/actions";
import { useSelector, useDispatch } from "react-redux";
import { getStoredToken } from "../../../utils/tokenutil";

const SchedulePlaydateDetailsScreen = ({ route, navigation }) => {
  const dispatch = useDispatch();
  const userId = useSelector((state) => state.userReducer.userId);
  const error = useSelector((state) => state.userReducer.error);
  const { petId, locationId } = route.params;
  const [date, setDate] = useState(new Date());
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (error) {
      Alert.alert("Error", error, [
        { text: "OK", onPress: () => dispatch(clearError()) },
      ]);
    }
  }, [error, dispatch]);

  const handleSubmit = async (selectedPet) => {
    // Prepare playdate data
    const playdateData = {
      Date: date,
      Location: locationId,
      Notes: notes,
      Participants: [userId], // Ensure this is the current user's ID
      PetsInvolved: [petId], // Ensure this is the ID of the pet involved in the playdate
      Creator: userId, // ID of the user creating the playdate
    };

    try {
      const token = await getStoredToken();
      // Send the playdate data to the backend
      const response = await axios.post("/api/playdates", playdateData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data) {
        Alert.alert(
          "Playdate Created",
          `Your playdate with ${selectedPet.name} created successfully.`,
          [
            {
              text: "OK",
              onPress: () =>
                navigation.navigate("PlaydateCreated", {
                  playdate: response.data,
                }),
            },
          ]
        );
      } else {
        // Handle case where no data is returned
        Alert.alert(
          "Playdate Creation Failed",
          "No playdate data returned from the server. Please try again.",
          [
            {
              text: "OK",
            },
          ]
        );
      }
    } catch (error) {
      console.error("Error creating playdate:", error);
      Alert.alert(
        "Playdate Creation Failed",
        "Unable to create playdate. Please try again."
      );
    }
  };

  const handleSubmitWrapper = (selectedPet, pet) =>
    handleSubmit(selectedPet, pet, dispatch);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lets Get Down To Details</Text>
      <DateTimePickerComponent date={date} onDateChange={setDate} mode="date" />
      <DateTimePickerComponent date={date} onDateChange={setDate} mode="time" />
      <TextInput
        style={styles.input}
        placeholder="Notes for the playdate"
        multiline
        numberOfLines={4}
        onChangeText={setNotes}
        value={notes}
      />
      <Button title="Submit Playdate" onPress={handleSubmitWrapper} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  input: {
    borderColor: "gray",
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
});

export default SchedulePlaydateDetailsScreen;
