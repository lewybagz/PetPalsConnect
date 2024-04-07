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
import Icon from "react-native-vector-icons/MaterialCommunityIcons"; // Make sure to install this package
import axios from "axios";
import { sendPushNotification } from "../../services/NotificationService";
import { useSelector } from "react-redux";
import { getStoredToken } from "../../utils/tokenutil";

const UserPetCard = ({ data, type, reviews, onPress, navigation }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const currentUser = useSelector((state) => state.user.currentUser);

  const handleBlockUser = async (userIdToBlock) => {
    try {
      const token = await getStoredToken();
      const response = await axios.post(
        "/api/blocklist",
        {
          BlockedUser: userIdToBlock,
          Owner: data.user._id,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.status === 201) {
        Alert.alert("User Blocked", "The user has been successfully blocked.");
        setModalVisible(false);
      }
    } catch (error) {
      console.error("Error blocking user:", error);
      Alert.alert("Error", "Failed to block user.");
    }
  };

  const navigateToReportUser = (userIdToReport) => {
    // Navigate to the ReportUserScreen and pass the userID to report
    navigation.navigate("ReportUser", { userId: userIdToReport });
    setModalVisible(false); // Close the modal
  };

  const handleAddToFavorites = async (petId) => {
    try {
      const token = await getStoredToken(); // Retrieve the token
      const response = await axios.post(
        "/api/favorites",
        {
          content: petId,
          user: data.user._id,
          creator: data.user._id,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
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
    // Ensure currentUser is available
    if (!currentUser) {
      console.error("Current user not found");
      return;
    }
    try {
      const token = await getStoredToken(); // Retrieve the token
      const response = await axios.post(
        "/api/friends",
        {
          senderId: currentUser,
          recipientId: userId,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.status === 201) {
        // Friend request sent successfully, now send notification
        await sendPushNotification({
          recipientUserId: userId, // ID of the user receiving the friend request
          title: "New Friend Request",
          message: "You have a new friend request!",
          data: {
            /* additional data if needed */
          },
        });

        Alert.alert("Friend Request Sent", "A friend request has been sent.");
        setModalVisible(false);
      } else {
        Alert.alert(
          "Friend Request Failed",
          "Unable to send a friend request at this time."
        );
      }
    } catch (error) {
      console.error("Error:", error);
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
    navigation.navigate("PotentialPlaydateLocation", { locationId });
  };

  const renderPetCard = (petData) => {
    return (
      <TouchableOpacity style={styles.UserPetCard} onPress={onPress}>
        <Image style={styles.image} source={{ uri: petData.photo }} />
        <Text style={styles.name}>{petData.name}</Text>
        <Text style={styles.details}>Breed: {petData.breed}</Text>
        <TouchableOpacity
          style={styles.addFriendIcon}
          onPress={() => handleAddFriend(petData.ownerId)}
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
      </TouchableOpacity>
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
