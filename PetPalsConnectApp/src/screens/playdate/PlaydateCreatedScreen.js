import React, { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import PlayDateLocationCard from "../../components/PlaydateLocationCardComponent"; // Assuming this component displays location details
import { Image, Button } from "react-native";
import messaging from "@react-native-firebase/messaging";

const PlaydateCreatedScreen = ({ route, navigation }) => {
  const { playdate, pet } = route.params;

  useEffect(() => {
    const unsubscribe = messaging().onNotificationOpenedApp((remoteMessage) => {
      if (remoteMessage.data.type === "playdateReview") {
        navigation.navigate("PostPlaydateReview", {
          playdateId: remoteMessage.data.playdateId,
          petId: remoteMessage.data.petId,
        });
      }
    });

    // Check if the app was opened by a notification when it was in quit state
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage && remoteMessage.data.type === "playdateReview") {
          navigation.navigate("PostPlaydateReview", {
            playdateId: remoteMessage.data.playdateId,
            petId: remoteMessage.data.petId,
          });
        }
      });

    return unsubscribe;
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.toDateString()} at ${date.toLocaleTimeString()}`;
  };

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: pet.photos[0] }} style={styles.petImage} />
      <Text style={styles.header}>Playdate Scheduled Successfully!</Text>
      <View style={styles.detailsContainer}>
        <Text style={styles.label}>Date & Time:</Text>
        <Text style={styles.detail}>{formatDate(playdate.Date)}</Text>

        <Text style={styles.label}>Location:</Text>
        <PlayDateLocationCard
          locationData={playdate.Location}
          navigation={navigation}
        />

        {playdate.Notes && (
          <>
            <Text style={styles.label}>Notes:</Text>
            <Text style={styles.detail}>{playdate.Notes}</Text>
          </>
        )}
      </View>
      <Button
        title="Done"
        onPress={() => navigation.navigate("ScheduledPlaydatesScreen")}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  petImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignSelf: "center",
    marginBottom: 10,
  },
  detailsContainer: {
    padding: 10,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  label: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 10,
  },
  detail: {
    fontSize: 16,
    marginBottom: 10,
  },
});

export default PlaydateCreatedScreen;
