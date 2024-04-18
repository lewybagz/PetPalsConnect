import React, { useState } from "react";
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Modal,
  Image,
  StyleSheet,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { getStoredToken } from "../../utils/tokenutil";
import { useSelector } from "react-redux";
import { setError } from "../redux/actions";
import axios from "axios";

const SwipeableUserPetCard = ({ data, type, reviews, onPress, navigation }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const currentUser = useSelector((state) => state.userReducer.user);

  const getToken = async () => {
    try {
      const token = await getStoredToken();
      return token;
    } catch (err) {
      setError(err.message);
    }
  };

  const handleBlockUser = async (userIdToBlock) => {
    try {
      const token = await getToken();
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
    navigation.navigate("ReportUser", { userId: userIdToReport });
    setModalVisible(false);
  };

  const handleAddToFavorites = async (petId, token) => {
    try {
      getToken();
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
      Alert.alert("Error adding to favorites:", error);
    }
  };

  const handleAddFriend = async (userId, token) => {
    if (!currentUser) {
      console.error("Current user not found");
      return;
    }
    try {
      const response = await axios.post(
        "/api/friends",
        {
          senderId: currentUser._id,
          recipientId: userId,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

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
      console.error("Error:", error);
      Alert.alert(
        "Error",
        "There was an error when attempting to send a friend request."
      );
    }
  };

  const renderUserCard = (userData) => {
    return (
      <View style={styles.UserPetCard}>
        <Image style={styles.image} source={{ uri: userData.profileImage }} />
        <Text style={styles.name}>{userData.name}</Text>
        <Text style={styles.details}>{userData.location}</Text>
      </View>
    );
  };

  const navigateToLocation = (locationId) => {
    navigation.navigate("PotentialPlaydateLocation", { locationId });
  };

  const renderPetCard = (petData, isFriend) => {
    return (
      <TouchableOpacity style={styles.UserPetCard} onPress={onPress}>
        <Image style={styles.image} source={{ uri: petData.photo }} />
        <Text style={styles.name}>{petData.name}</Text>
        <Text style={styles.details}>Breed: {petData.breed}</Text>
        {isFriend ? null : (
          <TouchableOpacity
            style={styles.addFriendIcon}
            onPress={() => handleAddFriend(petData.ownerId)}
          >
            <Icon name="account-plus" size={24} color="#5cb85c" />
          </TouchableOpacity>
        )}
        {reviews.map((review) => (
          <View key={review._id}>
            <Text>{review.comment}</Text>
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

  const renderRightActions = (progress, dragX) => {
    const trans = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [0, 100],
      extrapolate: "clamp",
    });

    return (
      <TouchableOpacity
        style={{
          width: 100,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "red",
        }}
        onPress={() => console.log("Remove friend action")}
      >
        <Animated.View style={{ transform: [{ translateX: trans }] }}>
          <Icon name="account-minus" size={30} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable renderRightActions={renderRightActions}>
      <View>
        {renderContent()}
        {renderKebabMenu()}
      </View>
    </Swipeable>
  );
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

export default SwipeableUserPetCard;
