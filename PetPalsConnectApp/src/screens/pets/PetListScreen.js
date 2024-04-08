import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import axios from "axios";
import { useSelector, useDispatch } from "react-redux";
import UserPetCard from "./UserPetCard";
import { getStoredToken } from "../../../utils/tokenutil";
import LoadingScreen from "../../components/LoadingScreenComponent";
import { clearError } from "../../redux/actions";

const PetListScreen = ({ route, navigation }) => {
  const { participants } = route.params || {};
  const dispatch = useDispatch();

  const currentUser = useSelector((state) => state.userReducer.currentUser);
  const userId = useSelector((state) => state.userReducer.userId);
  const isLoading = useSelector((state) => state.userReducer.isLoading);
  const error = useSelector((state) => state.userReducer.error);

  const [pets, setPets] = useState(participants || []);
  const [matchedPets, setMatchedPets] = useState([]);

  // Handle the display and clearing of errors
  useEffect(() => {
    if (error) {
      Alert.alert("Error", error, [
        { text: "OK", onPress: () => dispatch(clearError()) },
      ]);
    }
  }, [error, dispatch]);

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

    if (isLoading) {
      return <LoadingScreen />;
    }

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
