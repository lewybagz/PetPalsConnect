import React, { useState, useEffect, useMemo, useCallback } from "react";
import { View, FlatList, StyleSheet, Alert } from "react-native";
import api from "../../api/axios";
import UserPetCard from "../../components/UserPetCardComponent";
import { Button, EmptyState, useToast } from "../../components/ui";
import { useTokens } from "../../context/AppThemeContext";
import { space } from "../../styles/tokens";

/**
 * The pets this account owns - "Manage my pets" from the profile.
 *
 * Profile's button pointed at `PetList`, which fetches `/api/pets`: every
 * browsable pet in the app, not yours. So "manage my pets" opened a directory
 * of strangers' dogs with a delete button next to each.
 *
 * This screen was also unreachable and would have thrown if reached - it was
 * declared `(navigation)` rather than `({ navigation })`, binding the whole
 * props object, so every tap called `navigate` on something that has no such
 * method. It passed a Firebase uid to a route whose parameter is a Mongo id
 * too; harmless only because `getUserPets` ignores the parameter and scopes to
 * `req.userId`, which is the id that actually decides whose pets come back.
 */
const UsersPetsScreen = ({ navigation }) => {
  const tokens = useTokens();
  const toast = useToast();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      // The API client attaches the Firebase token; a hand-rolled
      // Authorization header here is a second way to get that wrong.
      const response = await api.get("/api/users/pets");
      setPets(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.warn("[userspets]", error.message);
      toast.error("Couldn't load your pets.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", load);
    return unsubscribe;
  }, [navigation, load]);

  const confirmDelete = (pet) => {
    // Removing a pet takes its matches, chats and playdates with it, so this
    // is one of the few things that earns an Alert rather than a toast.
    Alert.alert(
      `Remove ${pet.name}?`,
      "This takes their matches and playdates with them.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => remove(pet._id),
        },
      ]
    );
  };

  const remove = async (petId) => {
    try {
      await api.delete(`/api/users/pets/${petId}`);
      setPets((current) => current.filter((pet) => pet._id !== petId));
      toast.success("Pet removed");
    } catch (error) {
      console.warn("[userspets]", error.message);
      toast.error("Couldn't remove that pet.");
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={pets}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <UserPetCard
              data={item}
              onPress={() => navigation.navigate("PetDetails", { petId: item._id })}
            />
            <Button
              title="Remove"
              variant="danger"
              onPress={() => confirmDelete(item)}
            />
          </View>
        )}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              title="No pets yet"
              message="Add a pet and they'll show up here."
            />
          )
        }
      />
    </View>
  );
};

const makeStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    padding: space.md,
  },
  row: {
    marginBottom: space.lg,
  },
});

export default UsersPetsScreen;
