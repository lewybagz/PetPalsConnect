import React from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { useSelector, useDispatch } from "react-redux";
import { setChatId } from "../../redux/actions";

const PetDetailsScreen = ({ route }) => {
  const navigation = useNavigation();
  const userId = useSelector((state) => state.user.userId);
  const { pet } = route.params;

  // Define the getOrCreateChatId function
  const getOrCreateChatId = async (userId, petId) => {
    try {
      const response = await axios.post("/api/chats/findOrCreate", {
        userId,
        petId,
      });
      return response.data.chatId;
    } catch (error) {
      console.error("Error getting or creating chatId:", error);
      return null;
    }
  };

  const handleChat = async () => {
    const dispatch = useDispatch();
    // Assuming the function to get or create chatId
    const chatId = await getOrCreateChatId(userId, pet._id);
    dispatch(setChatId(chatId)); // Dispatch the chatId to Redux
    navigation.navigate("ChatScreen", { pet, chatId });
  };

  const handleFavorite = async () => {
    try {
      // Assuming 'currentUser' holds the authenticated user's data

      const creatorID = userId;

      await axios.post("/api/favorites", {
        content: pet._id, // pet's ID
        user: userId, // Current user's ID
        creator: creatorID, // ID of the user who created the pet profile
      });

      Alert.alert(
        "Favorite Added",
        `${pet.name} has been added to your favorites.`
      );
    } catch (error) {
      Alert.alert("Error", "Failed to add to favorites");
    }
  };

  const handleSchedulePlaydate = () => {
    navigation.navigate("SchedulePlaydateScreen", { pet });
  };

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: pet.photos[0] }} style={styles.image} />
      <Text style={styles.name}>{pet.name}</Text>
      <Text style={styles.detail}>Breed: {pet.breed}</Text>
      <Text style={styles.detail}>Age: {pet.age}</Text>
      <Text style={styles.detail}>Weight: {pet.weight}</Text>
      {pet.specialNeeds && (
        <Text style={styles.detail}>Special Needs: {pet.specialNeeds}</Text>
      )}
      <Text style={styles.detail}>Temperament: {pet.temperament}</Text>
      <View style={styles.buttonsContainer}>
        <TouchableOpacity onPress={handleChat} style={styles.iconButton}>
          <Icon name="comments" size={20} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleFavorite} style={styles.iconButton}>
          <Icon name="heart" size={20} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSchedulePlaydate}
          style={styles.iconButton}
        >
          <Icon name="calendar" size={20} color="white" />
          <Text style={styles.buttonText}>Schedule Playdate</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: 10,
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 8,
  },
  detail: {
    fontSize: 18,
    marginTop: 4,
  },
  buttonText: {
    color: "white",
    fontSize: 14,
  },
  iconButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 5,
    margin: 5,
  },
});

export default PetDetailsScreen;
