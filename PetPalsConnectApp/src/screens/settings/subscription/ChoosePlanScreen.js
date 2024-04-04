import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
} from "react-native";
import axios from "axios";
import { getStoredToken } from "../../../../utils/tokenutil";

const subscriptionTiers = [
  {
    id: "basic",
    title: "Basic",
    price: "$4.99/month",
    duration: "1 Month",
    features: [
      "Access to basic pet matching",
      "View and post to community forums",
      "Limited direct messages per day",
    ],
  },
  {
    id: "premium",
    title: "Premium",
    price: "$9.99/month",
    duration: "1 Month",
    features: [
      "Unlimited pet matching",
      "Priority access to community forums",
      "Unlimited direct messages",
      "Access to advanced pet analytics",
    ],
  },
  {
    id: "vip",
    title: "VIP",
    price: "$19.99/month",
    duration: "1 Month",
    features: [
      "All Premium features",
      "Free participation in pet events",
      "Access to VIP-only forums",
      "Exclusive discounts on pet products",
    ],
  },
];

const SubscriptionOptionsScreen = () => {
  const [selectedTier, setSelectedTier] = useState(null);

  const handleSelectTier = async (tierId) => {
    setSelectedTier(tierId);

    try {
      const token = await getStoredToken(); // Retrieve the token
      const response = await axios.post(
        "/api/subscriptions/create-checkout-session",
        { planId: tierId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const sessionId = response.data.sessionId;
      const url = `https://checkout.stripe.com/pay/${sessionId}`; // Construct the Stripe checkout URL
      Linking.openURL(url).catch((err) => {
        console.error("Error opening Stripe:", err);
        Alert.alert("Error", "Unable to open Stripe checkout.");
      });
    } catch (error) {
      console.error("Error creating Stripe checkout session:", error);
      Alert.alert("Error", "Failed to initiate payment process.");
    }
  };

  return (
    <ScrollView style={styles.container}>
      {subscriptionTiers.map((tier) => (
        <TouchableOpacity
          key={tier.id}
          style={[styles.tier, selectedTier === tier.id && styles.selectedTier]}
          onPress={() => handleSelectTier(tier.id)}
        >
          <Text style={styles.title}>{tier.title}</Text>
          <Text style={styles.price}>{tier.price}</Text>
          <Text style={styles.duration}>{tier.duration}</Text>
          <View style={styles.featuresList}>
            {tier.features.map((feature, index) => (
              <Text key={index} style={styles.feature}>
                {feature}
              </Text>
            ))}
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tier: {
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    padding: 20,
    margin: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  selectedTier: {
    borderColor: "#007bff",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
  },
  price: {
    fontSize: 18,
    fontWeight: "600",
    color: "#d9534f",
  },
  duration: {
    fontSize: 16,
    marginBottom: 10,
  },
  featuresList: {
    marginTop: 10,
  },
  feature: {
    fontSize: 16,
    color: "#5e5e5e",
  },
});

export default SubscriptionOptionsScreen;
