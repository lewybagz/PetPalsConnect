import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";

/**
 * The schema is lowercase - `title`, `content`, `publishedDate`. This read
 * `article.Title`, `article.Content` and `article.PublishedDate`, so the title
 * and date rendered blank and `.substring` was called on undefined, which
 * throws. `publishedDate` also arrives as an ISO string over JSON, so
 * `.toLocaleDateString()` on it would have thrown even with the right name.
 *
 * A missing `article` now renders nothing instead of throwing: callers fetch it
 * asynchronously and pass null on the first render.
 */
const ArticleCard = ({ article, onPress }) => {
  if (!article) return null;

  const published = article.publishedDate ? new Date(article.publishedDate) : null;
  const summary = (article.content ?? "").slice(0, 100);

  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      {article.imageUrl ? (
        <Image source={{ uri: article.imageUrl }} style={styles.image} />
      ) : null}

      <View style={styles.textContainer}>
        <Text style={styles.title}>{article.title}</Text>
        {summary ? (
          <Text numberOfLines={2} style={styles.content}>
            {summary}
            {article.content.length > 100 ? "..." : ""}
          </Text>
        ) : null}
        {published && !Number.isNaN(published.valueOf()) ? (
          <Text style={styles.date}>{published.toLocaleDateString()}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

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
