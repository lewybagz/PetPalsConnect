import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import LoadingScreen from "../../components/LoadingScreenComponent";
import axios from "axios";
import Icon from "react-native-vector-icons/FontAwesome5";

const PlaydateHistoryScreen = ({ navigation }) => {
  const [pastPlaydates, setPastPlaydates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPastPlaydates = async () => {
      try {
        // Replace with your actual API endpoint
        const response = await axios.get("/api/playdates/past");
        setPastPlaydates(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPastPlaydates();
  }, []);

  const renderPlaydateItem = ({ item }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() =>
        navigation.navigate("PlaydateDetail", { playdateId: item._id })
      }
    >
      <Text style={styles.title}>{item.petName}</Text>
      <Text>Date: {new Date(item.date).toLocaleDateString()}</Text>
      <Text>Location: {item.locationName}</Text>
      <Text>With: {item.partnerPetName}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <LoadingScreen />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Icon name="exclamation-circle" size={30} color="#FF0000" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={pastPlaydates}
          renderItem={renderPlaydateItem}
          keyExtractor={(item) => item._id.toString()}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  item: {
    backgroundColor: "#f8f8f8",
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    marginTop: 8,
    fontSize: 16,
    color: "red",
  },
});

export default PlaydateHistoryScreen;
