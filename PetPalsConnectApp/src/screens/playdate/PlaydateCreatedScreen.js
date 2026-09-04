import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Image, Button } from "react-native";
import messaging from "@react-native-firebase/messaging";
import { useTokens } from "../../context/AppThemeContext";

const PlaydateCreatedScreen = ({ route, navigation }) => {
  const tokens = useTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  /**
   * The pet comes off the playdate, not the caller.
   *
   * This read `pet.photos[0]` on a param the location-first flow never passed,
   * so the confirmation crashed at the end of a playdate that had already been
   * created. The create response populates `petsInvolved`, which is a better
   * source anyway: it is what the server actually recorded.
   */
  const { playdate = {}, pet: passedPet } = route.params ?? {};
  const pet =
    passedPet ??
    (Array.isArray(playdate.petsInvolved) ? playdate.petsInvolved.at(-1) : null);
  const photo = pet?.photos?.[0] ?? null;

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
      {photo ? (
        <Image source={{ uri: photo }} style={styles.petImage} />
      ) : null}
      <Text style={styles.header}>Playdate Scheduled Successfully!</Text>
      <View style={styles.detailsContainer}>
        <Text style={styles.label}>Date & Time:</Text>
        <Text style={styles.detail}>{formatDate(playdate.date)}</Text>

        <Text style={styles.label}>Location:</Text>
        {/* A summary, not a location card: the card carries a "Schedule a
            Playdate Here" button, which is a strange thing to offer on the
            screen confirming the playdate you have just scheduled there - and
            it dereferenced `locationData._id` on a playdate whose location
            failed to populate. */}
        <Text style={styles.detail}>
          {playdate.location?.name ??
            playdate.location?.address ??
            "The place you chose"}
        </Text>

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
    color: t.text,
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
    color: t.text,
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 10,
  },
  detail: {
    color: t.text,
    fontSize: 16,
    marginBottom: 10,
  },
});

export default PlaydateCreatedScreen;
