import React, { useState, useEffect } from "react";
import { View, Text, Button, StyleSheet, Alert } from "react-native";
import LoadingScreen from "../../../components/LoadingScreenComponent";
import axios from "axios";
import { useSelector } from "react-redux";
import { getStoredToken } from "../../../../utils/tokenutil";
import { setError } from "../../../redux/actions";

const SubscriptionManagementScreen = () => {
  const userId = useSelector((state) => state.userReducer.userId);
  const [subscription, setSubscription] = useState(null);
  const getToken = async () => {
    try {
      const token = await getStoredToken();
      return token;
    } catch (err) {
      setError(err.message);
    }
  };
  useEffect(() => {
    const fetchSubscription = async (token) => {
      if (userId) {
        try {
          getToken();
          const res = await axios.get(`/api/subscriptions/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setSubscription(res.data);
        } catch (error) {
          Alert.alert("Error", "Could not load subscription information.");
        }
      }
    };

    fetchSubscription();
  }, [userId]);

  const handleRenew = async (token) => {
    try {
      getToken();
      const res = await axios.post(
        `/api/subscriptions/renew`,
        {
          userId: userId,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSubscription(res.data);
      Alert.alert("Success", "Subscription renewed successfully.");
    } catch (error) {
      console.error("Renewal error:", error);
      Alert.alert("Error", "Failed to renew subscription.");
    }
  };

  const handleChangePlan = async (planType, token) => {
    try {
      getToken();
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
      setSubscription(res.data);
      Alert.alert("Success", "Plan changed successfully.");
    } catch (error) {
      console.error("Plan change error:", error);
      Alert.alert("Error", "Failed to change plan.");
    }
  };

  const handleCancel = async (token) => {
    try {
      getToken();
      const res = await axios.post(
        `/api/subscriptions/cancel`,
        {
          userId: userId,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSubscription(res.data);
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
