import React, { useState, useEffect } from "react";
import { View, Text, Button, Alert } from "react-native";
import DateTimePickerComponent from "../../components/DateTimePickerComponent";
import { useSelector } from "react-redux";

const PlaydateModificationScreen = ({ route, navigation }) => {
  const userId = useSelector((state) => state.user.userId);
  const { playdateId } = route.params;
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [location, setLocation] = useState(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (route.params?.selectedLocation) {
        setLocation(route.params.selectedLocation);
      }
    });
    return unsubscribe;
  }, [navigation, route.params?.selectedLocation]);

  const handleCancel = () => {
    Alert.alert(
      "Discard Changes",
      "Are you sure you want to discard your changes?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "OK",
          onPress: () => {
            setDate(new Date());
            setTime(new Date());
            setLocation(null);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const navigateToConfirmation = () => {
    if (!userId || !userId) {
      Alert.alert("Error", "User not authenticated.");
      return;
    }

    navigation.navigate("PlaydateModificationConfirmation", {
      playdateId,
      date,
      time,
      location,
      userId: userId,
    });
  };

  return (
    <View>
      <Text>Update Playdate Details</Text>
      <DateTimePickerComponent date={date} mode="date" onDateChange={setDate} />
      <DateTimePickerComponent date={time} mode="time" onDateChange={setTime} />
      <Button
        title="Choose Location"
        onPress={() => navigation.navigate("PotentialPlaydateLocationsScreen")}
      />
      <Button title="Update Playdate" onPress={navigateToConfirmation} />
      {location && <Text>Selected Location: {location.name}</Text>}
      <Button title="Cancel" onPress={handleCancel} />
    </View>
  );
};

export default PlaydateModificationScreen;
