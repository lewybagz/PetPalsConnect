import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useTailwind } from "nativewind";

const LegalPoliciesScreen = () => {
  const [selectedDocument, setSelectedDocument] = useState("terms");
  const tailwind = useTailwind();

  const renderDocumentContent = () => {
    switch (selectedDocument) {
      case "terms":
        return <Text>Terms of Service content here...</Text>; // Replace with actual Terms of Service text
      case "privacy":
        return <Text>Privacy Policy content here...</Text>; // Replace with actual Privacy Policy text
      default:
        return null;
    }
  };

  return (
    <ScrollView style={tailwind("p-4")}>
      <Text style={tailwind("text-xl font-bold mb-4")}>Legal Policies</Text>

      <View style={tailwind("flex-row mb-4")}>
        <TouchableOpacity
          onPress={() => setSelectedDocument("terms")}
          style={tailwind("mr-4")}
        >
          <Text style={tailwind("text-blue-500")}>Terms of Service</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSelectedDocument("privacy")}>
          <Text style={tailwind("text-blue-500")}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>

      <View>{renderDocumentContent()}</View>
    </ScrollView>
  );
};

export default LegalPoliciesScreen;
