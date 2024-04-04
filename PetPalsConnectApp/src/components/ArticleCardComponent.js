import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";

const ArticleCard = ({ article, onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.card}>
    {/* Optional: Display image if available */}
    {article.imageUrl && (
      <Image source={{ uri: article.imageUrl }} style={styles.image} />
    )}

    <View style={styles.textContainer}>
      <Text style={styles.title}>{article.Title}</Text>
      <Text numberOfLines={2} style={styles.content}>
        {article.Content.substring(0, 100)}...
      </Text>
      <Text style={styles.date}>
        {article.PublishedDate.toLocaleDateString()}
      </Text>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginVertical: 8,
    marginHorizontal: 16,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: 180,
    resizeMode: "cover",
  },
  textContainer: {
    padding: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  content: {
    fontSize: 14,
    color: "#666",
    marginBottom: 5,
  },
  date: {
    fontSize: 12,
    color: "#999",
  },
});

export default ArticleCard;
