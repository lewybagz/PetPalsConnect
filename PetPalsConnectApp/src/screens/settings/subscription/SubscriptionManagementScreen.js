import React, { useState, useEffect } from "react";
import { View, Text, Button, StyleSheet, Alert } from "react-native";
import LoadingScreen from "../../../components/LoadingScreenComponent";
import axios from "axios";
import { useSelector } from "react-redux";
import { getStoredToken } from "../../../../utils/tokenutil";

const SubscriptionManagementScreen = () => {
  const currentUser = useSelector((state) => state.user);
  const userId = useSelector((state) => state.user.userId);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      if (currentUser) {
        try {
          const token = await getStoredToken();
          const res = await axios.get(`/api/subscriptions/${currentUser.uid}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setSubscription(res.data);
        } catch (error) {
          Alert.alert("Error", "Could not load subscription information.");
        }
      }
    };

    fetchSubscription();
  }, [currentUser]);

  const handleRenew = async () => {
    try {
      const token = await getStoredToken(); // Retrieve the token
      const res = await axios.post(
        `/api/subscriptions/renew`,
        {
          userId: userId,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSubscription(res.data); // Update the subscription state
      Alert.alert("Success", "Subscription renewed successfully.");
    } catch (error) {
      console.error("Renewal error:", error);
      Alert.alert("Error", "Failed to renew subscription.");
    }
  };

  const handleChangePlan = async (planType) => {
    try {
      const token = await getStoredToken(); // Retrieve the token
      const res = await axios.post(
        `/api/subscriptions/change-plan`,
        {
          userId: userId,
          newPlan: planType,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSubscription(res.data); // Update the subscription state
      Alert.alert("Success", "Plan changed successfully.");
    } catch (error) {
      console.error("Plan change error:", error);
      Alert.alert("Error", "Failed to change plan.");
    }
  };

  const handleCancel = async () => {
    try {
      const token = await getStoredToken(); // Retrieve the token
      const res = await axios.post(
        `/api/subscriptions/cancel`,
        {
          userId: userId,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSubscription(res.data); // Update the subscription state
      Alert.alert("Success", "Subscription cancelled successfully.");
    } catch (error) {
      console.error("Cancellation error:", error);
      Alert.alert("Error", "Failed to cancel subscription.");
    }
  };

  return (
    <View style={styles.container}>
      {subscription ? (
        <>
          <Text style={styles.title}>Your Subscription</Text>
          <Text>Type: {subscription.PlanType}</Text>
          <Text>
            Start Date: {new Date(subscription.StartDate).toLocaleDateString()}
          </Text>
          <Text>
            End Date: {new Date(subscription.EndDate).toLocaleDateString()}
          </Text>
          <Text>Status: {subscription.Status}</Text>

          <Button title="Renew Subscription" onPress={handleRenew} />
          <Button
            title="Change Plan"
            onPress={() => handleChangePlan("New Plan Type")}
          />
          <Button
            title="Cancel Subscription"
            onPress={handleCancel}
            color="red"
          />
        </>
      ) : (
        <LoadingScreen />
      )}
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
});

export default SubscriptionManagementScreen;
