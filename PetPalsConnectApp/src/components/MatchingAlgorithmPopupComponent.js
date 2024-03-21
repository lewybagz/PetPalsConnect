import React from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native";

const MatchingAlgorithmPopup = ({ visible, onClose }) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalText}>
            🌟 Discover the Perfect Pals for Your Pet! 🌟
          </Text>
          <Text style={styles.modalText}>
            1. Basic Matching - A Paw-some Start!{"\n"}
            🐾 Breed Buddies: We start by finding potential pals that have
            similar or compatible breeds.{"\n"}
            🐕 Temperament Twins: We look at temperament too! If your pet is a
            couch potato or a playful pup, we find them a match with a similar
            vibe.
          </Text>
          <Text style={styles.modalText}>
            2. Premium Playmates - Tail Wagging Deluxe! (Exclusive for
            Subscribed Users){"\n"}
            🎉 Activity Allies: For our subscribed members, we go the extra
            mile!{"\n"}
            🐩 Social Stars: We also consider how social your pet is.{"\n"}✨
            Extra Special Matches: We delve deeper for our subscribed users,
            considering even more details to ensure every playdate is just
            perfect.
          </Text>
          <Text style={styles.modalText}>
            Every match is a chance for a new friendship, a new adventure, and
            countless tail wags! Whether you’re using our basic or premium
            service, we&rsquo;re dedicated to finding the most paw-fect pals for
            your pet. Let&rsquo;s embark on this exciting journey together! 🐾✨
          </Text>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Got It!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
  },
  button: {
    borderRadius: 20,
    padding: 10,
    elevation: 2,
    backgroundColor: "#2196F3",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
});

export default MatchingAlgorithmPopup;
