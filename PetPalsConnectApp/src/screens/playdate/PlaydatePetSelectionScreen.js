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
import { useSelector } from "react-redux";
import BottomSheet from "@gorhom/bottom-sheet";
import { CheckBox } from "react-native-elements";
import { getRealm } from "../../../../backend/models/Pet";
import { getStoredToken } from "../../../utils/tokenutil";

const PlaydatePetSelectionScreen = ({ route, navigation }) => {
  const [matchedPets, setMatchedPets] = useState([]);
  const [userPets, setUserPets] = useState([]);
  const { locationId } = route.params;
  const [selectedPets, setSelectedPets] = useState([]);

  useEffect(() => {
    const checkCachedPets = async () => {
      const realm = await getRealm();
      const cachedPets = realm.objects("Pet");

      if (cachedPets.length > 0) {
        setUserPets(cachedPets);
      } else {
        await fetchUserPets();
      }
    };

    const fetchMatchedPets = async () => {
      try {
        const token = await getStoredToken();
        const matchedPetsResponse = await axios.get(
          "/api/petmatches/matched-pets",
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMatchedPets(matchedPetsResponse.data);
      } catch (error) {
        console.error("Error fetching matched pets:", error);
      }
    };

    const fetchUserPets = async () => {
      const userId = useSelector((state) => state.userReducer.userId);
      try {
        const token = await getStoredToken();
        const userPetsResponse = await axios.get(`/api/users/pets/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUserPets(userPetsResponse.data);

        const realm = await getRealm();

        realm.write(() => {
          userPetsResponse.data.forEach((pet) => {
            realm.create(
              "Pet",
              {
                ...pet,
                _id: pet._id.toString(),
              },
              true
            );
          });
        });
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
