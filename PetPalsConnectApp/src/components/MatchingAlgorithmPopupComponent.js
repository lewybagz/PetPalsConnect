import React from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native";

const MatchingAlgorithmPopup = ({ visible, onClose, navigation }) => {
  const onNavigateToSubscription = () => {
    onClose(); // Close the current modal
    navigation.navigate("ChoosePlan");
  };

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

          {/* Basic Matching Section */}
          <Text style={styles.modalText}>
            🐾{" "}
            <Text style={styles.featureTitle}>
              Basic Matching - A Paw-some Start!
            </Text>
            {"\n"}Find friends based on breed and temperament compatibility.
          </Text>

          {/* Premium Matching Section */}
          <Text style={styles.modalText}>
            🎉{" "}
            <Text style={styles.featureTitle}>
              Premium Playmates - Tail Wagging Deluxe!
            </Text>{" "}
            (Exclusive for Subscribers)
            {"\n"}Enhanced matching considering activity preferences, social
            behavior, and more for the most compatible playdates.
          </Text>

          {/* Success Story/Testimonial */}
          {/* Add this section if you have testimonials or success stories */}

          {/* Subscription Call to Action */}
          <TouchableOpacity
            style={styles.subscribeButton}
            onPress={onNavigateToSubscription}
          >
            <Text style={styles.buttonText}>Upgrade for Better Matches</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Got It!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  featureTitle: {
    fontWeight: "bold",
  },
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
