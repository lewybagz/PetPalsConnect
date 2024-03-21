import React, { useState, useEffect } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import axios from "axios";
import UserPetCard from "../../components/UserPetCard";
import BottomSheet from "@gorhom/bottom-sheet";
import { CheckBox } from "react-native-elements";

const PlaydatePetSelectionScreen = ({ route, navigation }) => {
  const [matchedPets, setMatchedPets] = useState([]);
  const [userPets, setUserPets] = useState([]);
  const { locationId } = route.params;
  const [selectedPets, setSelectedPets] = useState([]);

  useEffect(() => {
    const fetchMatchedPets = async () => {
      try {
        const matchedPetsResponse = await axios.get("/api/matched-pets");
        setMatchedPets(matchedPetsResponse.data);
      } catch (error) {
        console.error("Error fetching matched pets:", error);
      }
    };

    // Fetch user's pets
    const fetchUserPets = async () => {
      try {
        const userPetsResponse = await axios.get("/api/user-pets");
        setUserPets(userPetsResponse.data);
      } catch (error) {
        console.error("Error fetching user's pets:", error);
      }
    };

    fetchMatchedPets();
    fetchUserPets();
  }, []);

  const handleSelectPet = (petId) => {
    if (selectedPets.includes(petId)) {
      setSelectedPets(selectedPets.filter((id) => id !== petId));
    } else {
      setSelectedPets([...selectedPets, petId]);
    }
  };

  const handleSubmitSelection = () => {
    if (selectedPets.length > 0) {
      // Navigate with the selected pet IDs
      navigation.navigate("SchedulePlaydateDetailsScreen", {
        petIds: selectedPets,
        locationId,
      });
    } else {
      // Show an alert or message to select at least one pet
      Alert.alert("Select Pets", "Please select at least one pet to continue.");
    }
  };

  const showPetSelectionSheet = () => {
    if (userPets.length > 1) {
      BottomSheet.show({
        data: userPets,
        renderItem: ({ item }) => (
          <View style={styles.petSelectionItem}>
            <CheckBox
              value={selectedPets.includes(item._id)}
              onValueChange={() => handleSelectPet(item._id)}
            />
            <UserPetCard data={item} type="pet" />
          </View>
        ),
        title: "Which of your pets are coming?",
        onConfirm: handleSubmitSelection,
      });
    } else if (userPets.length === 1) {
      handleSelectPet(userPets[0]._id);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={matchedPets}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => showPetSelectionSheet()}>
            <UserPetCard data={item} type="pet" />
          </TouchableOpacity>
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
  petSelectionItem: {
    flexDirection: "row",
    alignItems: "center",
    // Add other styling as needed
  },
});

export default PlaydatePetSelectionScreen;
