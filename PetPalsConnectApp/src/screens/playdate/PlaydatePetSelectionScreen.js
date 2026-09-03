import React, { useState, useEffect } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import api from "../../api/axios";
import UserPetCard from "../../components/UserPetCardComponent";
import { useSelector } from "react-redux";
import BottomSheet from "@gorhom/bottom-sheet";
import { CheckBox } from "../../components/CheckBox";
import { readCache, writeCache, CacheKeys } from "../../services/localCache";

const PlaydatePetSelectionScreen = ({ route, navigation }) => {
  const [matchedPets, setMatchedPets] = useState([]);
  const [userPets, setUserPets] = useState([]);
  const { locationId } = route.params;
  const [selectedPets, setSelectedPets] = useState([]);
  const userId = useSelector((state) => state.user.userId);

  useEffect(() => {
    const checkCachedPets = async () => {
      // Realm reached end-of-life in September 2025; this is a plain
      // AsyncStorage read-through cache with the same behaviour.
      const cachedPets = await readCache(CacheKeys.pets);
      if (cachedPets?.length > 0) {
        setUserPets(cachedPets);
      } else {
        await fetchUserPets();
      }
    };

    const fetchMatchedPets = async () => {
      try {
        const matchedPetsResponse = await api.get("/api/petmatches/matched-pets");
        setMatchedPets(matchedPetsResponse.data);
      } catch (error) {
        console.error("Error fetching matched pets:", error);
      }
    };

    // `userId` comes from the component-level useSelector below. Reading it via
    // useSelector inside this callback (as before) breaks the rules of hooks.
    const fetchUserPets = async () => {
      try {
        const userPetsResponse = await api.get(`/api/users/pets/${userId}`);
        setUserPets(userPetsResponse.data);
        await writeCache(CacheKeys.pets, userPetsResponse.data);
      } catch (error) {
        console.error("Error fetching user's pets:", error);
      }
    };

    fetchMatchedPets();
    checkCachedPets();
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
      navigation.navigate("SchedulePlaydateDetails", {
        petIds: selectedPets,
        locationId,
      });
    } else {
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
