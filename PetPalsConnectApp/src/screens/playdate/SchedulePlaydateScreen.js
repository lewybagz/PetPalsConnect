import React, { useState, useEffect } from "react";
import {
  Text,
  TextInput,
  StyleSheet,
  Button,
  ScrollView,
  TouchableOpacity,
  Alert,
  FlatList,
} from "react-native";
import axios from "axios"; // Assuming axios is used for API calls
import { auth } from "../../firebase/firebaseConfig";
import { sendPushNotification } from "../services/NotificationService"; // a hypothetical service to handle notifications
import { Image } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigation } from "@react-navigation/native";
import PlayDateLocationCard from "../../components/PlaydateLocationCardComponent";
import DateTimePickerComponent from "../../components/DateTimePickerComponent";

const SchedulePlaydateScreen = ({ route }) => {
  const navigation = useNavigation();
  const { pet } = route.params;

  const [time, setTime] = useState(new Date());
  const [date, setDate] = useState(new Date());
  const [notes, setNotes] = useState("");
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);

  useEffect(() => {
    // Fetch playdate locations
    const fetchLocations = async () => {
      try {
        const response = await axios.get("/api/potential-playdate-locations");
        setLocations(response.data);
      } catch (error) {
        console.error("Error fetching locations:", error);
      }
    };

    fetchLocations();
  }, []);

  const handleSubmit = async () => {
    const userId = auth.currentUser.uid;
    const userName = auth.currentUser.name;
    // Prepare playdate data
    const playdateData = {
      Date: date,
      Location: selectedLocation._id, // Assuming the selectedLocation has an _id
      Notes: notes,
      Participants: [userId], // Assuming currentUser is the logged-in user
      PetsInvolved: [pet._id], // Assuming pet is the selected pet for the playdate
      Creator: userId, // currentUser._id represents the ID of the logged-in user
    };

    try {
      // Send a POST request to create a playdate
      const response = await axios.post("/api/playdates", playdateData);
      if (response.data) {
        sendPushNotification({
          recipientUserId: pet.owner._id, // Assuming you have the owner's ID
          title: "Playdate Request",
          message: `${userName} has requested a playdate with ${pet.name}`,
          data: { playdateId: response.data._id }, // Include the playdate ID to navigate to the details
        });
      }
      // Navigate to PlaydateCreatedScreen with the created playdate data
      navigation.navigate("PlaydateCreatedScreen", { playdate: response.data });
    } catch (error) {
      console.error("Error creating playdate:", error);
      // Show an error message
      Alert.alert(
        "Playdate Creation Failed",
        "Unable to create playdate. Please try again."
      );
    }
  };

  const renderLocationItem = ({ item }) => (
    <TouchableOpacity onPress={() => setSelectedLocation(item)}>
      <PlayDateLocationCard locationData={item} />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: pet.photos[0] }} style={styles.petImage} />
      <Text style={styles.header}>
        <Icon name="calendar" size={20} color="#007bff" /> Schedule a Playdate
        with {pet.name}
      </Text>

      <Text style={styles.label}>
        <Icon name="map-marker" size={20} color="#007bff" /> Select Location
      </Text>
      <FlatList
        data={locations}
        keyExtractor={(item) => item._id}
        renderItem={renderLocationItem}
      />

      <DateTimePickerComponent
        mode="date"
        date={date}
        onDateChange={setDate}
        style={styles.datePicker}
      />

      {/* Time Picker */}
      <DateTimePickerComponent
        mode="time"
        date={time}
        onDateChange={setTime}
        style={styles.timePicker}
      />

      <TextInput
        style={styles.input}
        placeholder="Enter location"
        value={location}
        onChangeText={setLocations}
      />

      <TextInput
        style={styles.input}
        placeholder="Add notes (Optional)"
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <Button title="Schedule Playdate" onPress={handleSubmit} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  label: {
    fontSize: 18,
    marginTop: 20,
    marginBottom: 10,
  },
  petImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignSelf: "center",
    marginTop: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "gray",
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
    height: 100,
    textAlignVertical: "top",
  },
  header: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  input: {
    borderColor: "gray",
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  datePicker: {
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#f0f0f0",
    borderRadius: 5,
  },
  timePicker: {
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#f0f0f0",
    borderRadius: 5,
  },
  dateText: {
    fontSize: 16,
  },
  timeText: {
    fontSize: 16,
  },
});

export default SchedulePlaydateScreen;
