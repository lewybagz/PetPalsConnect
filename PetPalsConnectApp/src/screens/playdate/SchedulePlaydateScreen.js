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
import { useSelector, useDispatch } from "react-redux";
import { Image } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { fetchUserPreferences } from "../../../services/UserService";
import PlayDateLocationCard from "../../components/PlaydateLocationCardComponent";
import DateTimePickerComponent from "../../components/DateTimePickerComponent";
import { getStoredToken } from "../../../utils/tokenutil";

const SchedulePlaydateScreen = ({ route, navigation }) => {
  const dispatch = useDispatch();
  const userId = useSelector((state) => state.userReducer.userId);
  const userName = useSelector((state) => state.userReducer.name);
  const { pet } = route.params;
  const [time, setTime] = useState(new Date());
  const [date, setDate] = useState(new Date());
  const [notes, setNotes] = useState("");
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const getToken = async () => {
    try {
      const token = await getStoredToken();
      return token;
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        // Assuming you have a way to get the current user's ID
        const userId = useSelector((state) => state.userReducer.userId);
        const userPrefs = await fetchUserPreferences(userId);
        const playdateRange = userPrefs.playdateRange;

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords;
              await fetchLocations(latitude, longitude, playdateRange);
            },
            (err) => {
              console.error(err);
              setError(err.message);
            }
          );
        } else {
          setError("Geolocation is not supported by this browser");
        }
      } catch (err) {
        console.error("Error initializing:", err);
        setError("Initialization failed");
      }
    };

    initialize();
  }, []);

  const fetchLocations = async (latitude, longitude, playdateRange, token) => {
    try {
      getToken();
      const response = await axios.get("/api/locations/playdate-locations", {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          userLat: latitude,
          userLng: longitude,
          range: playdateRange,
        },
      });
      setLocations(response.data);
    } catch (error) {
      console.error("Error fetching locations:", error);
      setError(error.message);
    }
  };

  const handleSubmit = async (token) => {
    // Prepare playdate data
    const playdateData = {
      Date: date,
      Location: selectedLocation._id,
      Notes: notes,
      Participants: [userId],
      PetsInvolved: [pet._id],
      Creator: userId,
    };

    try {
      getToken();
      const response = await axios.post("/api/playdates", playdateData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data) {
        Alert.alert(
          "Playdate Created",
          `Your playdate with ${pet.name} created successfully.`,
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

  const handleSubmitWrapper = () => handleSubmit(dispatch, userId, userName);

  const renderLocationItem = ({ item }) => (
    <TouchableOpacity onPress={() => setSelectedLocation(item)}>
      <PlayDateLocationCard locationData={item} navigation={navigation} />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      {error && <Text style={styles.errorText}>Error: {error}</Text>}
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
        placeholder="Notes for the playdate"
        multiline
        numberOfLines={4}
        onChangeText={setNotes}
        value={notes}
      />

      <Button title="Schedule Playdate" onPress={handleSubmitWrapper} />
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
