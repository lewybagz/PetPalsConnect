import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, FlatList, TextInput, StyleSheet } from "react-native";
import ArticleCard from "../../components/ArticleCardComponent";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { getStoredToken } from "../../../utils/tokenutil";

import api from "../../api/axios";
import { useTokens } from "../../context/AppThemeContext";

const ArticlesScreen = ({ navigation }) => {
  const tokens = useTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const [articles, setArticles] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchLatestArticles = useCallback(async () => {
    try {
      const token = await getStoredToken(); // Retrieve the token
      const response = await api.get("/api/articles/latest", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setArticles(response.data);
    } catch (error) {
      console.error("Error fetching latest articles:", error);
    }
   }, []);

  useEffect(() => {
    fetchLatestArticles();
  }, [fetchLatestArticles]);

  const handleSearch = async () => {
    if (searchQuery) {
      try {
        const token = await getStoredToken(); // Retrieve the token
        const response = await api.get(
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

const makeStyles = (t) => StyleSheet.create({
  searchBar: {
    padding: 10,
    margin: 10,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: 5,
  },
  // ... other styles
});

export default ArticlesScreen;
