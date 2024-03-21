// ReviewComponent.js
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";

const ReviewComponent = ({ reviewData }) => {
  // Render stars based on the rating
  const renderStars = () => {
    let stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Icon
          key={i}
          name={i <= reviewData.rating ? "star" : "star-o"}
          size={20}
          color="#FFD700"
        />
      );
    }
    return stars;
  };

  return (
    <View style={styles.reviewCard}>
      <Text style={styles.comment}>{reviewData.comment}</Text>
      <View style={styles.rating}>{renderStars()}</View>
      <Text style={styles.date}>
        {new Date(reviewData.date).toLocaleDateString()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  reviewCard: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    marginBottom: 10,
  },
  comment: {
    fontSize: 16,
    color: "#333",
    marginBottom: 5,
  },
  rating: {
    flexDirection: "row",
    marginBottom: 5,
  },
  date: {
    fontSize: 14,
    color: "#666",
    textAlign: "right",
  },
});

export default ReviewComponent;
