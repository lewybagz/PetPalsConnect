import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

const SubscriptionConfirmationScreen = ({ route, navigation }) => {
  // Assuming the route params include the subscription details
  const { action, planType, startDate, endDate } = route.params;

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Subscription Confirmation</Text>
      <Text style={styles.message}>
        Your subscription has been successfully {action}.
      </Text>

      <Text style={styles.detail}>Plan Type: {planType}</Text>
      <Text style={styles.detail}>Start Date: {startDate}</Text>
      <Text style={styles.detail}>End Date: {endDate}</Text>

      <TouchableOpacity onPress={handleGoBack} style={styles.button}>
        <Text style={styles.buttonText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  message: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 20,
  },
  detail: {
    fontSize: 16,
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#007bff",
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
  },
});

export default SubscriptionConfirmationScreen;
