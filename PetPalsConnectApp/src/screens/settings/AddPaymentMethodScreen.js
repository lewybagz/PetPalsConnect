import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { useTailwind } from "../../styles/tailwind";
import api from "../../api/axios";
import { getStoredToken } from "../../../utils/tokenutil";
import { useToast } from "../../components/ui";

const AddPaymentMethodScreen = ({ navigation }) => {
  const [cardNumber, setCardNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvv, setCvv] = useState("");
  const { zipCode, setZipCode } = useState("");
  const tailwind = useTailwind();
  const toast = useToast();

  const handleAddPaymentMethod = async () => {
    if (!cardNumber || !expiryDate || !cvv) {
      toast.show("Fill in every field first.");
      return;
    }

    try {
      const token = await getStoredToken();
      // API call to backend to add payment method
      await api.post(
        "/api/payments/payment-methods",
        {
          cardNumber,
          expiryDate,
          cvv,
          zipCode,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success("Payment method added");
      navigation.goBack();
    } catch (error) {
      console.error("Error adding payment method:", error);
      toast.error("Couldn't add that payment method.");
    }
  };

  const handleExpiryDateChange = (text) => {
    if (text.length === 2 && expiryDate.length < 2 && !text.includes("/")) {
      setExpiryDate(`${text}/`);
    } else {
      setExpiryDate(text);
    }
  };

  return (
    <View style={tailwind("p-4")}>
      <Text style={tailwind("text-xl font-bold mb-4")}>Add Payment Method</Text>
      <TextInput
        style={tailwind("border border-border p-2 mb-2")}
        placeholder="Card Number"
        value={cardNumber}
        onChangeText={setCardNumber}
        keyboardType="numeric"
        maxLength={16}
      />
      <TextInput
        style={tailwind("border border-border p-2 mb-2")}
        placeholder="Expiry Date (MM/YY)"
        value={expiryDate}
        onChangeText={handleExpiryDateChange}
        keyboardType="numeric"
        maxLength={5}
      />
      <TextInput
        style={tailwind("border border-border p-2 mb-4")}
        placeholder="CVV"
        value={cvv}
        onChangeText={setCvv}
        keyboardType="numeric"
        maxLength={3}
      />
      <TextInput
        style={tailwind("border border-border p-2 mb-4")}
        placeholder="Zip Code"
        value={zipCode}
        onChangeText={setZipCode}
        keyboardType="numeric"
        maxLength={5}
      />
      <TouchableOpacity
        onPress={handleAddPaymentMethod}
        style={tailwind("bg-primary py-2 px-4 rounded")}
      >
        <Text style={tailwind("text-onPrimary text-center")}>
          Add Payment Method
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default AddPaymentMethodScreen;
