import React, { useState, useEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import axios from "axios";
import { useSelector } from "react-redux";
import UserPetCard from "./UserPetCard";
import { getStoredToken } from "../../../utils/tokenutil";

const PetListScreen = ({ route }) => {
  const { participants } = route.params || {};
  const currentUser = useSelector((state) => state.user);
  const userId = useSelector((state) => state.user.userId);
  const navigation = useNavigation();
  const [pets, setPets] = useState(participants || []);
  const [matchedPets, setMatchedPets] = useState([]);

  useEffect(() => {
    const fetchMatchedPets = async (userId) => {
      try {
        const token = await getStoredToken();
        const matchedResponse = await axios.get(`/api/petmatches/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMatchedPets(matchedResponse.data);
      } catch (error) {
        Alert.alert("Error", "Failed to load matched pets");
      }
    };

    if (!participants) {
      const fetchPets = async () => {
        try {
          const token = await getStoredToken();
          const response = await axios.get("/api/pets", {
            headers: { Authorization: `Bearer ${token}` },
          });
          setPets(response.data);
          if (currentUser) {
            fetchMatchedPets(userId);
          }
        } catch (error) {
          Alert.alert("Error", "Failed to load pets");
        }
      };

      fetchPets();
    }
  }, [currentUser, participants]);

  const isPetMatched = (petId) => {
    return matchedPets.some(
      (match) =>
        (match.Pet1 === petId || match.Pet2 === petId) &&
        (match.Pet1 === currentUser || match.Pet2 === currentUser)
    );
  };

  const filteredPets = pets.filter((pet) => isPetMatched(pet._id));
  const handleDelete = async (petId) => {
    try {
      const token = await getStoredToken(); // Retrieve the token
      await axios.delete(`/api/pets/${petId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPets(pets.filter((pet) => pet._id !== petId));
    } catch (error) {
      Alert.alert("Error", "Failed to delete pet");
    }
  };
  return (
    <View style={styles.container}>
      <FlatList
        data={filteredPets} // Changed from pets to filteredPets
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View>
            <TouchableOpacity
              onPress={() => navigation.navigate("PetDetails", { pet: item })}
            >
              <UserPetCard data={item} type="pet" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(item._id)}
              style={styles.deleteButton}
            >
              <Text style={styles.buttonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  deleteButton: {
    backgroundColor: "red",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
  },
});

export default PetListScreen;
