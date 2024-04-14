import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { useSelector } from "react-redux";

const FriendRequestsCard = ({ friendRequest, onAccept, onDecline }) => {
  const currentUser = useSelector((state) => state.userReducer.user);
  const isSender = currentUser.pets.some(
    (pet) => pet._id === friendRequest.sender._id
  );

  const firstPet = isSender
    ? friendRequest.receiver.pets[0]
    : friendRequest.sender.pets[0];

  const firstPetName = firstPet ? firstPet.name : "No pet name available";

  const firstPetPhoto =
    firstPet && firstPet.photos && firstPet.photos.length > 0
      ? firstPet.photos[0]
      : "No photo available";

  return (
    <View style={styles.card}>
      <Text style={styles.text}>Pet Photo: {firstPetPhoto}</Text>
      <Text style={styles.text}>
        {isSender ? "Sent To: " : "Request from: "}
        {firstPetName}
      </Text>
      <Text style={styles.text}>{friendRequest.status}</Text>
      <Text style={styles.text}>
        {isSender ? "Sent on: " : "Received on: "}
        {new Date(friendRequest.createdDate).toLocaleDateString()}
      </Text>

      {!isSender && friendRequest.status === "pending" && (
        <View style={styles.buttonContainer}>
          <Button title="Accept" onPress={() => onAccept(friendRequest)} />
          <Button title="Decline" onPress={() => onDecline(friendRequest)} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 10,
    padding: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 5,
  },
  text: {
    marginBottom: 5,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
});

export default FriendRequestsCard;
