import React, { useEffect, useState } from "react";
import {
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Image,
} from "react-native";
import LoadingScreen from "../../components/LoadingScreenComponent";
import UserPetCard from "../../components/UserPetCardComponent";
import { useTailwind } from "nativewind";
import { getStoredToken } from "../../../utils/tokenutil";

import axios from "axios";

const ChatDetailsScreen = ({ route, navigation }) => {
  const { chatId, isGroupChat } = route.params;
  const [chatDetails, setChatDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const tailwind = useTailwind();

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const token = await getStoredToken(); // Retrieve the token
        const endpoint = isGroupChat
          ? `/api/groupchats/${chatId}/details`
          : `/api/chats/${chatId}/details`;
        const response = await axios.get(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setChatDetails(response.data);
      } catch (error) {
        console.error("Failed to fetch chat details:", error);
        // Handle error
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [chatId, isGroupChat]);

  useEffect(() => {
    // Reset loading state when navigating back to this screen
    const unsubscribe = navigation.addListener("focus", () => {
      setLoading(false);
    });

    return unsubscribe;
  }, [navigation]);

  const viewAllMedia = () => {
    setLoading(true);
    navigation.navigate("MediaView", { media: chatDetails.media });
  };

  const viewAllPets = () => {
    setLoading(true);
    navigation.navigate("PetList", {
      participants: chatDetails.participants,
    });
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!chatDetails) {
    return <Text>No details available</Text>;
  }

  return (
    <ScrollView>
      {isGroupChat && (
        <>
          <Text>Group Name: {chatDetails.groupName}</Text>
          <Text>Group Chat ID: {chatDetails.groupChatId}</Text>
        </>
      )}
      {!isGroupChat && <Text>Chat ID: {chatDetails.chatId}</Text>}
      {isGroupChat && (
        <>
          <Text>
            Number of Participants: {chatDetails.participants?.length}
          </Text>
          <FlatList
            data={chatDetails.participants?.slice(0, 5)}
            horizontal
            renderItem={({ item }) => (
              <UserPetCard
                data={item}
                type="pet"
                reviews={item.reviews || []}
              />
            )}
            keyExtractor={(item, index) => item._id || index.toString()}
          />
          {chatDetails.participants?.length > 5 && (
            <TouchableOpacity onPress={viewAllPets} style={tailwind("mt-2")}>
              <Text style={tailwind("text-blue-500")}>View All</Text>
            </TouchableOpacity>
          )}
        </>
      )}
      <Text>Number of Messages: {chatDetails.messages?.length}</Text>
      <Text style={tailwind("font-bold mb-2")}>Media:</Text>
      <FlatList
        data={chatDetails.media?.slice(-6)} // Get the last 6 media items
        horizontal
        renderItem={({ item }) => (
          <Image
            source={{ uri: item.url }} // Replace with actual property
            style={styles.mediaImage}
          />
        )}
        keyExtractor={(item, index) => item._id || index.toString()}
      />
      {chatDetails.media?.length > 6 && (
        <TouchableOpacity onPress={viewAllMedia} style={tailwind("mt-2")}>
          <Text style={tailwind("text-blue-500")}>View All</Text>
        </TouchableOpacity>
      )}
      {/* Additional details as needed */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  mediaImage: {
    width: 100,
    height: 100,
    marginRight: 10,
    borderRadius: 10, // Adjust as needed
  },
});

export default ChatDetailsScreen;
