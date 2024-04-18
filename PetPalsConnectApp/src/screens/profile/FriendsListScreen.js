import React, { useState, useEffect } from "react";
import { View, FlatList, StyleSheet } from "react-native";
import { useRealm } from "../../../realmModels/RealmFriendModel";
import { useSocketFriendRequest } from "../../hooks/useSocketFriendRequest";
import SwipeableUserPetCard from "../swipe/SwipeableUserPetCard";
const FriendsListScreen = ({ navigation }) => {
  const [friends, setFriends] = useState([]);
  const [friendIds, setFriendIds] = useState(new Set());
  const realm = useRealm();

  useEffect(() => {
    const loadFriends = () => {
      const friendsList = realm.objects("Friend").filtered("status == true");
      setFriends(friendsList);
      const ids = new Set(friendsList.map((friend) => friend.user2)); // Assuming 'user2' is the friend's ID
      setFriendIds(ids);
    };

    loadFriends();

    // Use the socket hook here
    useSocketFriendRequest(loadFriends);
  }, [realm]);

  const navigateToPetDetails = (petId) => {
    navigation.navigate("PetDetails", { petId });
  };

  const renderItem = ({ item }) => {
    const friendUserId = item.user1; // logic based on your data structure
    const friendData = realm.objectForPrimaryKey("User", friendUserId);

    // Assuming we are navigating to the details of the first pet in the array
    const petId = friendData.pets.length > 0 ? friendData.pets[0] : null;

    return (
      <SwipeableUserPetCard
        data={friendData}
        onPress={() => petId && navigateToPetDetails(petId)}
        isFriend={friendIds.has(friendUserId)}
      />
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={friends}
        keyExtractor={(item) => item._id.toString()}
        renderItem={renderItem}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },
  // ...other styles
});

export default FriendsListScreen;
