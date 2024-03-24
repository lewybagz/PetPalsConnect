import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTailwind } from "nativewind";
import axios from "axios";

const PaymentMethodsScreen = () => {
  const navigation = useNavigation();
  const [paymentMethods, setPaymentMethods] = useState([]);
  const tailwind = useTailwind();

  useEffect(() => {
    // API call to backend to fetch payment methods
    axios
      .get("/api/payments/payment-methods")
      .then((response) => {
        setPaymentMethods(response.data);
      })
      .catch((error) => {
        console.error("Error fetching payment methods:", error);
      });
  }, []);

  const handleAddPaymentMethod = () => {
    navigation.navigate("AddPaymentMethod");
  };

  const handleDeletePaymentMethod = async (id) => {
    // Confirm deletion with user
    Alert.alert(
      "Delete Payment Method",
      "Are you sure you want to delete this payment method?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          onPress: () => {
            // API call to backend to delete payment method
            axios
              .delete(`/api/payments/payment-methods/${id}`)
              .then(() => {
                // Refresh payment methods list upon successful deletion
                setPaymentMethods(
                  paymentMethods.filter((method) => method.id !== id)
                );
              })
              .catch((error) => {
                console.error("Error deleting payment method:", error);
              });
          },
          style: "destructive",
        },
      ]
    );
  };

  const renderItem = ({ item }) => (
    <View style={tailwind("border-b border-gray-200 py-2")}>
      <Text
        style={tailwind("text-lg")}
      >{`${item.type} ending in ${item.last4}`}</Text>
      <Text
        style={tailwind("text-sm text-gray-600")}
      >{`Exp: ${item.exp}`}</Text>
      <TouchableOpacity onPress={() => handleDeletePaymentMethod(item.id)}>
        <Text style={tailwind("text-red-500 mt-1")}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={tailwind("p-4")}>
      <Text style={tailwind("text-xl font-bold mb-4")}>Payment Methods</Text>
      <FlatList
        data={paymentMethods}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
      />
      <TouchableOpacity
        onPress={handleAddPaymentMethod}
        style={tailwind("mt-4 bg-blue-500 py-2 px-4 rounded")}
      >
        <Text style={tailwind("text-white text-center")}>
          Add Payment Method
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default PaymentMethodsScreen;
