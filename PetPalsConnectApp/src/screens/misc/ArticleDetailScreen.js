import React, { useState, useEffect } from "react";
import { ScrollView, Text, StyleSheet } from "react-native";
import LoadingScreen from "../../components/LoadingScreenComponent";
import axios from "axios";
import { getStoredToken } from "../../../utils/tokenutil";

const ArticleDetailScreen = ({ route }) => {
  const { articleId } = route.params;
  const [article, setArticle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        setIsLoading(true);
        const token = await getStoredToken(); // Retrieve the token
        const response = await axios.get(`/api/articles/${articleId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setArticle(response.data);
      } catch (error) {
        console.error("Error fetching article:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticle();
  }, [articleId]);

  if (isLoading) {
    return <LoadingScreen />; // Or any loading indicator you prefer
  }

  if (!article) {
    return <Text>Article not found.</Text>;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{article.Title}</Text>
      <Text style={styles.date}>
        {new Date(article.PublishedDate).toLocaleDateString()}
      </Text>
      <Text style={styles.content}>{article.Content}</Text>
      {/* You can add more article details here if needed */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  date: {
    fontSize: 14,
    color: "gray",
    marginBottom: 10,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    // other styles for the content
  },
  // Add more styles as needed
});

export default ArticleDetailScreen;
