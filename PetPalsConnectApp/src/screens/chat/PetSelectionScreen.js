// PetSelectionScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";
import axios from "axios";
import { getStoredToken } from "../../../utils/tokenutil";

const PetSelectionScreen = ({ navigation, route }) => {
  const [pets, setPets] = useState([]); // All available pets for selection
  const [selectedPets, setSelectedPets] = useState([]);
  const { userPetId } = route.params;

  useEffect(() => {
    const fetchPetFriends = async () => {
      try {
        const token = await getStoredToken(); // Retrieve the token
        const response = await axios.get(`/api/friends/${userPetId}/pets`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPets(response.data);
      } catch (error) {
        console.error("Error fetching pet friends:", error);
      }
    };

    fetchPetFriends();
  }, []);

  const handlePetSelect = (pet) => {
    const isSelected = selectedPets.some(
      (selectedPet) => selectedPet.id === pet._id
    );

    if (isSelected) {
      setSelectedPets(selectedPets.filter((p) => p.id !== pet._id));
    } else {
      setSelectedPets([...selectedPets, { id: pet._id, name: pet.name }]);
    }
  };

  const navigateToGroupChatCreation = () => {
    if (selectedPets.length === 0) {
      Alert.alert("Select Pets", "Please select at least one pet to continue.");
      return;
    }
    navigation.navigate("GroupChatCreation", { selectedPets });
  };

  return (
    <View style={styles.container}>
      <View style={styles.selectedContainer}>
        {selectedPets.map((pet) => (
          <View key={pet.id} style={styles.selectedItem}>
            <Text style={styles.selectedText}>{pet.name}</Text>
          </View>
        ))}
      </View>

      <FlatList
        data={pets}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handlePetSelect(item)}>
            <Text>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity
        style={styles.doneButton}
        onPress={navigateToGroupChatCreation}
      >
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between", // Adjust the layout to make room for the button
  },
  selectedContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 10,
  },
  selectedItem: {
    backgroundColor: "#e7e7e7",
    borderRadius: 15,
    padding: 8,
    margin: 4,
  },
  selectedText: {
    fontWeight: "bold",
  },
  doneButton: {
    backgroundColor: "#007bff",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    margin: 10,
  },
  doneButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});

export default PetSelectionScreen;
