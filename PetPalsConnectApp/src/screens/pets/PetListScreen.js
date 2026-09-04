import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import api from "../../api/axios";
import { useSelector, useDispatch } from "react-redux";
import UserPetCard from "../../components/UserPetCardComponent";
import { getStoredToken } from "../../../utils/tokenutil";
import LoadingScreen from "../../components/LoadingScreenComponent";
import { clearError } from "../../redux/actions";
import { useTokens } from "../../context/AppThemeContext";
import { useToast } from "../../components/ui";

const PetListScreen = ({ route, navigation }) => {
  const tokens = useTokens();
  const toast = useToast();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const { participants } = route.params || {};
  const dispatch = useDispatch();

  const currentUser = useSelector((state) => state.user.user);
  const userId = useSelector((state) => state.user.userId);
  const isLoading = useSelector((state) => state.user.isLoading);
  const error = useSelector((state) => state.user.error);

  const [pets, setPets] = useState(participants || []);
  const [matchedPets, setMatchedPets] = useState([]);

  // Handle the display and clearing of errors
  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch, toast]);

  useEffect(() => {
    const fetchMatchedPets = async (userId) => {
      try {
        const token = await getStoredToken();
        const matchedResponse = await api.get(`/api/petmatches/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMatchedPets(matchedResponse.data);
      } catch (error) {
        console.warn("[petlist]", error.message);
        toast.error("Couldn't load your matches.");
      }
    };

    if (isLoading) {
      return <LoadingScreen />;
    }

    if (!participants) {
      const fetchPets = async () => {
        try {
          const token = await getStoredToken();
          const response = await api.get("/api/pets", {
            headers: { Authorization: `Bearer ${token}` },
          });
          setPets(response.data);
          if (currentUser) {
            fetchMatchedPets(userId);
          }
        } catch (error) {
          console.warn("[petlist]", error.message);
          toast.error("Couldn't load your pets.");
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
      await api.delete(`/api/pets/${petId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPets(pets.filter((pet) => pet._id !== petId));
    } catch (error) {
      console.warn("[petlist]", error.message);
      toast.error("Couldn't remove that pet.");
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

const makeStyles = (t) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  deleteButton: {
    backgroundColor: t.danger,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: t.surface,
    fontSize: 16,
  },
});

export default PetListScreen;
