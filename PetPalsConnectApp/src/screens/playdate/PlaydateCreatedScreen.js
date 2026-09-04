import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Image, Button } from "react-native";
import PlayDateLocationCard from "../../components/PlaydateLocationCardComponent"; // Assuming this component displays location details
import messaging from "@react-native-firebase/messaging";
import { useTokens } from "../../context/AppThemeContext";

const PlaydateCreatedScreen = ({ route, navigation }) => {
  const tokens = useTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

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
        <Text style={styles.detail}>{formatDate(playdate.date)}</Text>

        <Text style={styles.label}>Location:</Text>
        <PlayDateLocationCard
          locationData={playdate.location}
          navigation={navigation}
        />

        {playdate.notes && (
          <>
            <Text style={styles.label}>Notes:</Text>
            <Text style={styles.detail}>{playdate.notes}</Text>
          </>
        )}
      </View>
      <Button
        title="Done"
        onPress={() => navigation.navigate("Playdates")}
      />
    </ScrollView>
  );
};

const makeStyles = (t) => StyleSheet.create({
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
    backgroundColor: t.surfaceAlt,
    borderRadius: 8,
    shadowColor: t.text,
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
