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
import {
  sendPushNotification,
  createNotificationInDB,
} from "../services/NotificationService";
import { getPetOwner } from "../../../services/PetService";
import { Image } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { fetchUserPreferences } from "../../../services/UserService";
import PlayDateLocationCard from "../../components/PlaydateLocationCardComponent";
import DateTimePickerComponent from "../../components/DateTimePickerComponent";
import { getStoredToken } from "../../../utils/tokenutil";
import { addNotification } from "../../redux/actions";

const SchedulePlaydateScreen = ({ route, navigation }) => {
  const dispatch = useDispatch();
  const userId = useSelector((state) => state.user.userId);
  const userName = useSelector((state) => state.user.name);
  const { pet } = route.params;
  const [time, setTime] = useState(new Date());
  const [date, setDate] = useState(new Date());
  const [notes, setNotes] = useState("");
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Assuming you have a way to get the current user's ID
        const userId = useSelector((state) => state.user.userId);
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

  const fetchLocations = async (latitude, longitude, playdateRange) => {
    try {
      const token = await getStoredToken();
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

  const handleSubmit = async () => {
    const userId = useSelector((state) => state.user.userId);
    const userName = useSelector((state) => state.user);
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
      const token = await getStoredToken(); // Retrieve the token
      const response = await axios.post("/api/playdates", playdateData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data) {
        const ownerId = await getPetOwner(pet._id);

        if (ownerId) {
          sendPushNotification({
            recipientUserId: ownerId,
            title: "Playdate Request",
            message: `${userName} has requested a playdate with ${pet.name}`,
            data: { playdateId: response.data._id },
          });

          const notificationData = {
            content: "A playdate has been requested",
            recipientId: ownerId,
            type: "Playdate Request",
            creatorId: userId,
          };

          createNotificationInDB(notificationData);

          // Dispatch the notification to Redux
          dispatch(addNotification(notificationData));
        } else {
          console.log("Owner ID not found for pet");
        }
      }
      navigation.navigate("PlaydateCreatedScreen", { playdate: response.data });
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
