import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { FontAwesome as Icon } from "@expo/vector-icons";
import { useDispatch } from "react-redux";

import api from "../../api/axios";
import { setChatId } from "../../redux/actions";

/**
 * One pet's profile, and the three things you can do from it.
 *
 * It took the whole pet through route params: `const { pet } = route.params`.
 * That only works when the caller already has the document, and the two places
 * that reach this screen from a card - Discover and Home - have an id. It also
 * threw outright on `route.params` being undefined, which is what a push
 * notification or a deep link gives you. It now accepts either, and fetches
 * when it is handed an id.
 *
 * `getOrCreateChatId` also returned `data.chatId`, which is the hash the
 * server derives the conversation key from, not the document's `_id` - the
 * value ChatScreen needs to load or post messages.
 */
const PetDetailsScreen = ({ route, navigation }) => {
  const dispatch = useDispatch();

  const passedPet = route?.params?.pet ?? null;
  const petId = route?.params?.petId ?? passedPet?._id;

  const [pet, setPet] = useState(passedPet);
  const [loading, setLoading] = useState(!passedPet && Boolean(petId));

  useEffect(() => {
    if (passedPet || !petId) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/api/pets/${petId}`);
        if (!cancelled) setPet(data);
      } catch (error) {
        if (cancelled) return;
        console.warn("[pet]", error.message);
        Alert.alert("Error", "Could not load this pet.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [petId, passedPet]);

  const handleChat = async () => {
    try {
      // The server takes the caller from the token and the other participant
      // from the pet's owner; sending a userId here did nothing but let a
      // client claim to be someone else.
      const { data } = await api.post("/api/chats/findOrCreate", { petId: pet._id });
      dispatch(setChatId(data._id));
      navigation.navigate("Chat", { pet, chatId: data._id });
    } catch (error) {
      console.warn("[pet] chat failed:", error.message);
      Alert.alert("Error", "Could not open a chat about this pet.");
    }
  };

  const handleFavorite = async () => {
    try {
      await api.post("/api/favorites", { content: pet._id });
      Alert.alert("Favorite Added", `${pet.name} has been added to your favorites.`);
    } catch (error) {
      console.warn("[pet] favourite failed:", error.message);
      Alert.alert("Error", "Failed to add to favorites");
    }
  };

  const handleSchedulePlaydate = () => {
    navigation.navigate("SchedulePlaydate", { pet });
  };

  if (loading) {
    return (
      <View testID="pet-loading" style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!pet) {
    return (
      <View testID="pet-missing" style={styles.centered}>
        <Text style={styles.detail}>This pet is no longer available.</Text>
      </View>
    );
  }

  return (
    <ScrollView testID="pet-details" style={styles.container}>
      {pet.photos?.[0] ? (
        <Image source={{ uri: pet.photos[0] }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Icon name="paw" size={32} color="#9ca3af" />
        </View>
      )}
      <Text style={styles.name}>{pet.name}</Text>
      {pet.breed ? <Text style={styles.detail}>Breed: {pet.breed}</Text> : null}
      {pet.age != null ? <Text style={styles.detail}>Age: {pet.age}</Text> : null}
      {pet.weight != null ? (
        <Text style={styles.detail}>Weight: {pet.weight} lb</Text>
      ) : null}
      {pet.specialNeeds ? (
        <Text style={styles.detail}>Special Needs: {pet.specialNeeds}</Text>
      ) : null}
      {pet.temperament ? (
        <Text style={styles.detail}>Temperament: {pet.temperament}</Text>
      ) : null}

      <View style={styles.buttonsContainer}>
        <TouchableOpacity testID="pet-chat" onPress={handleChat} style={styles.iconButton}>
          <Icon name="comments" size={20} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          testID="pet-favorite"
          onPress={handleFavorite}
          style={styles.iconButton}
        >
          <Icon name="heart" size={20} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          testID="pet-playdate"
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
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: 10,
  },
  placeholder: {
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
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
  buttonsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
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
