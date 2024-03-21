import React, { useState } from "react";
import {
  Alert,
  Modal,
  TouchableOpacity,
  View,
  Text,
  Image,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons"; // Make sure to install this package
import axios from "axios";
import { auth } from "../../firebase/firebaseConfig";

const UserPetCard = ({ data, type, reviews }) => {
  const [modalVisible, setModalVisible] = useState(false);

  const navigation = useNavigation();

  const handleBlockUser = async (userIdToBlock) => {
    try {
      const response = await axios.post("/api/blocklist", {
        BlockedUser: userIdToBlock,
        Owner: data.user._id, // Assuming 'data.user._id' is the current user's ID
      });
      if (response.status === 201) {
        Alert.alert("User Blocked", "The user has been successfully blocked.");
        setModalVisible(false);
      }
    } catch (error) {
      console.error("Error blocking user:", error);
      // Handle error - show alert or a message
    }
  };

  const navigateToReportUser = (userIdToReport) => {
    // Navigate to the ReportUserScreen and pass the userID to report
    navigation.navigate("ReportUserScreen", { userId: userIdToReport });
    setModalVisible(false); // Close the modal
  };

  const handleAddToFavorites = async (petId) => {
    try {
      const response = await axios.post("/api/favorites", {
        content: petId, // Assuming you want to favorite the pet
        user: data.user._id, // Assuming 'data.user._id' is the current user's ID
        creator: data.user._id, // The ID of the user who is adding the favorite
      });
      if (response.status === 201) {
        Alert.alert("Favorite Added", "The pet has been added to favorites.");
        setModalVisible(false);
      }
    } catch (error) {
      console.error("Error adding to favorites:", error);
      // Handle error - show alert or a message
    }
  };

  const handleAddFriend = async (userId) => {
    try {
      // The endpoint and body may vary based on your backend implementation
      const response = await axios.post("/api/friends", {
        User1: auth.currentUser.uid, // Assuming this is the current logged-in user's ID
        User2: userId, // The ID of the user that is being added as a friend
        Status: true, // Assuming you're immediately setting the friend request as accepted for simplicity
      });

      if (response.status === 201) {
        Alert.alert("Friend Request Sent", "A friend request has been sent.");
        setModalVisible(false);
      } else {
        Alert.alert(
          "Friend Request Failed",
          "Unable to send a friend request at this time."
        );
      }
    } catch (error) {
      console.error("Error sending friend request:", error);
      Alert.alert(
        "Error",
        "There was an error when attempting to send a friend request."
      );
    }
  };

  const renderContent = () => {
    switch (type) {
      case "user":
        return renderUserCard(data);
      case "pet":
        return renderPetCard(data);
      default:
        return <Text>No data</Text>;
    }
  };

  const renderUserCard = (userData) => {
    return (
      <View style={styles.UserPetCard}>
        <Image style={styles.image} source={{ uri: userData.profileImage }} />
        <Text style={styles.name}>{userData.name}</Text>
        <Text style={styles.details}>{userData.location}</Text>
        {renderKebabMenu()}
      </View>
    );
  };

  const navigateToLocation = (locationId) => {
    navigation.navigate("PotentialPlaydateLocationScreen", { locationId });
  };

  const renderPetCard = (petData) => {
    return (
      <View style={styles.UserPetCard}>
        <Image style={styles.image} source={{ uri: petData.photo }} />
        <Text style={styles.name}>{petData.name}</Text>
        <Text style={styles.details}>Breed: {petData.breed}</Text>
        <TouchableOpacity
          style={styles.addFriendIcon}
          onPress={() => handleAddFriend(petData.ownerId)} // Replace ownerId with the actual owner's ID
        >
          <Icon name="account-plus" size={24} color="#5cb85c" />
        </TouchableOpacity>
        {reviews.map((review) => (
          <View key={review._id}>
            <Text>{review.comment}</Text>
            {/* Link to the Playdate Location */}
            <TouchableOpacity
              onPress={() =>
                navigateToLocation(review.RelatedPlaydate.location)
              }
            >
              <Text>See Playdate Location</Text>
            </TouchableOpacity>
          </View>
        ))}
        {renderKebabMenu()}
      </View>
    );
  };
  const renderKebabMenu = () => {
    return (
      <>
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={styles.kebabIcon}
        >
          <Icon name="dots-vertical" size={20} />
        </TouchableOpacity>
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => {
            setModalVisible(!modalVisible);
          }}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <TouchableOpacity
                onPress={() => handleBlockUser(data.user._id)}
                style={styles.optionButton}
              >
                <Text style={styles.optionText}>Block</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigateToReportUser(data.user._id)}
                style={styles.optionButton}
              >
                <Text style={styles.optionText}>Report</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleAddToFavorites(data.pet._id)}
                style={styles.optionButton}
              >
                <Text style={styles.optionText}>Add to Favorites</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.optionButton}
              >
                <Text style={styles.optionText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </>
    );
  };

  return <View>{renderContent()}</View>;
};
const styles = StyleSheet.create({
  UserPetCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  petCard: {
    // ... existing styling for the card
    flexDirection: "row", // Adjust the layout accordingly
    alignItems: "center", // Align items in the center
  },
  infoContainer: {
    flex: 1, // Take up remaining space
    // ... other styling for the container of text
  },
  addFriendIcon: {
    // Style the add friend button
    padding: 10, // Add padding for touchable area
    marginRight: 10, // Optional spacing from the edge of the card
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  name: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 8,
  },
  details: {
    fontSize: 14,
    color: "gray",
    marginTop: 4,
  },
  kebabIcon: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 8,
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
  optionButton: {
    padding: 10,
    elevation: 2,
  },
  optionText: {
    color: "black",
    fontWeight: "bold",
    textAlign: "center",
  },
});

export default UserPetCard;
