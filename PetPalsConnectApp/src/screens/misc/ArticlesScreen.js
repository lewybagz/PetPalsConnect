import React, { useState, useEffect } from "react";
import { View, FlatList, TextInput, StyleSheet } from "react-native";
import ArticleCard from "../../components/ArticleCardComponent";
import Icon from "react-native-vector-icons/MaterialIcons";
import { getStoredToken } from "../../../utils/tokenutil";

import axios from "axios";

const ArticlesScreen = ({ navigation }) => {
  const [articles, setArticles] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchLatestArticles();
  }, []);

  const fetchLatestArticles = async () => {
    try {
      const token = await getStoredToken(); // Retrieve the token
      const response = await axios.get("/api/articles/latest", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setArticles(response.data);
    } catch (error) {
      console.error("Error fetching latest articles:", error);
    }
  };

  const handleSearch = async () => {
    if (searchQuery) {
      try {
        const token = await getStoredToken(); // Retrieve the token
        const response = await axios.get(
          `/api/articles/search?q=${encodeURIComponent(searchQuery)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setArticles(response.data);
      } catch (error) {
        console.error("Error searching articles:", error);
      }
    } else {
      fetchLatestArticles();
    }
  };

  return (
    <View>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchBar}
          placeholder="Search articles..."
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          value={searchQuery}
        />
        <Icon name="search" style={styles.searchIcon} />
      </View>
      <FlatList
        data={articles}
        renderItem={({ item }) => (
          <ArticleCard
            article={item}
            onPress={() =>
              navigation.navigate("ArticleDetail", { articleId: item.id })
            }
          />
        )}
        keyExtractor={(item) => item.id.toString()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  searchBar: {
    padding: 10,
    margin: 10,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 5,
  },
  // ... other styles
});

export default ArticlesScreen;
