// PetSelectionScreen.js
import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";
import { fetchFriendsPets } from "../../api/friends";
import { useTokens } from "../../context/AppThemeContext";

const PetSelectionScreen = ({ navigation }) => {
  const tokens = useTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const [pets, setPets] = useState([]);
  const [selectedPets, setSelectedPets] = useState([]);

  useEffect(() => {
    // Was `GET /api/friends/${userPetId}/pets` - a *pet* id in a slot the
    // server matched against user ids - with a manually attached token the
    // shared client already sets. It returned an empty list every time, so
    // this screen has never offered a pet to pick.
    let cancelled = false;
    fetchFriendsPets()
      .then((friendsPets) => {
        if (!cancelled) setPets(friendsPets);
      })
      .catch((error) =>
        console.warn("[friends] Could not load friends' pets:", error.message)
      );

    return () => {
      cancelled = true;
    };
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

const makeStyles = (t) => StyleSheet.create({
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
    backgroundColor: t.surfaceAlt,
    borderRadius: 15,
    padding: 8,
    margin: 4,
  },
  selectedText: {
    color: t.text,
    fontWeight: "bold",
  },
  doneButton: {
    backgroundColor: t.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    margin: 10,
  },
  doneButtonText: {
    color: t.surface,
    fontWeight: "bold",
    fontSize: 16,
  },
});

export default PetSelectionScreen;
