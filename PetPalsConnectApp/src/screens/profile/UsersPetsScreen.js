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
import { getAuth } from "firebase/auth";
import UserPetCard from "../../components/UserPetCardComponent";
import { getStoredToken } from "../../../utils/tokenutil";

const UsersPetsScreen = (navigation) => {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const [userPets, setUserPets] = useState([]);

  useEffect(() => {
    const fetchUserPets = async () => {
      if (currentUser) {
        try {
          const token = await getStoredToken();
          const response = await axios.get(
            `/api/users/pets/${currentUser.uid}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setUserPets(response.data);
        } catch (error) {
          Alert.alert("Error", "Failed to load your pets");
        }
      }
    };

    fetchUserPets();
  }, [currentUser]);

  const handleNavigateToPetDetails = (petId) => {
    navigation.navigate("PetDetails", { petId });
  };

  const handleDelete = async (petId) => {
    try {
      const token = await getStoredToken();
      await axios.delete(`/api/users/pets/${petId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserPets(userPets.filter((pet) => pet._id !== petId));
    } catch (error) {
      Alert.alert("Error", "Failed to delete pet");
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={userPets}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View>
            <TouchableOpacity
              onPress={() => handleNavigateToPetDetails(item._id)}
            >
              <UserPetCard data={item} />
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

export default UsersPetsScreen;
