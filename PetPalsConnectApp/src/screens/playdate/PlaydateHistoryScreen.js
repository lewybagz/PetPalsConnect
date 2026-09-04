import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import LoadingScreen from "../../components/LoadingScreenComponent";
import api from "../../api/axios";
import { FontAwesome5 as Icon } from "@expo/vector-icons";
import { getStoredToken } from "../../../utils/tokenutil";
import PlaydateCardComponent from "../../components/PlaydateCardComponent";
import { useTokens } from "../../context/AppThemeContext";

const PlaydateHistoryScreen = ({ navigation }) => {
  const tokens = useTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const [pastPlaydates, setPastPlaydates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPastPlaydates = async () => {
      try {
        setLoading(true);
        const token = await getStoredToken();
        const response = await api.get("/api/playdates/past", {
          headers: { Authorization: `Bearer ${token}` },
        });
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
      onPress={() =>
        navigation.navigate("PlaydateDetails", { playdateId: item._id })
      }
    >
      <PlaydateCardComponent playdate={item} navigation={navigation} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <LoadingScreen />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Icon name="exclamation-circle" size={30} color={tokens.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={pastPlaydates}
          renderItem={renderPlaydateItem}
          keyExtractor={(item) => item._id.toString()} // Make sure to have .toString() if _id is a number
        />
      )}
    </View>
  );
};

const makeStyles = (t) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.surface,
  },
  item: {
    backgroundColor: t.surfaceAlt,
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: t.border,
  },
  title: {
    color: t.text,
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
    color: t.danger,
  },
});

export default PlaydateHistoryScreen;
