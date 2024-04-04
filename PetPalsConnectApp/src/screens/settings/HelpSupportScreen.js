import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useTailwind } from "nativewind";

const HelpSupportScreen = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const tailwind = useTailwind();

  const submitForm = () => {
    // TODO:
    // Logic to submit the form data
    // You might want to send this data to your backend or an email service
    Alert.alert(
      "Message Sent",
      "Thank you for reaching out. We will get back to you shortly."
    );
  };

  return (
    <ScrollView style={tailwind("p-4")}>
      <Text style={tailwind("text-xl font-bold mb-4")}>Help & Support</Text>

      {/* Contact Form */}
      <View>
        <TextInput
          style={tailwind("border border-gray-300 p-2 rounded mb-4")}
          value={name}
          onChangeText={setName}
          placeholder="Your Name"
        />
        <TextInput
          style={tailwind("border border-gray-300 p-2 rounded mb-4")}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          keyboardType="email-address"
        />
        <TextInput
          style={tailwind("border border-gray-300 p-2 rounded mb-4")}
          value={message}
          onChangeText={setMessage}
          placeholder="Message"
          multiline
        />
        <TouchableOpacity
          onPress={submitForm}
          style={tailwind("bg-blue-500 py-2 px-4 rounded")}
        >
          <Text style={tailwind("text-white text-center")}>Submit</Text>
        </TouchableOpacity>
      </View>

      {/* FAQs */}
      <View style={tailwind("mt-6")}>
        <Text style={tailwind("text-lg font-semibold mb-2")}>
          Frequently Asked Questions
        </Text>
        <Text style={tailwind("mb-2")}>
          Q: How do I change my pet&rsquo;s profile?
        </Text>
        <Text style={tailwind("mb-4")}>
          A: Go to your profile, select your pet, and tap &rsquo;Edit&rsquo;.
        </Text>
        <Text style={tailwind("mb-2")}>Q: Can I cancel a playdate?</Text>
        <Text style={tailwind("mb-4")}>
          A: Yes, go to the playdate details and select &rsquo;Cancel&rsquo;.
        </Text>
        <Text style={tailwind("mb-2")}>
          Q: What to do if I encounter a technical issue?
        </Text>
        <Text style={tailwind("mb-4")}>
          A: Contact us using the form above, detailing the issue.
        </Text>
      </View>

      {/* Contact Information */}
      <View style={tailwind("mt-6")}>
        <Text style={tailwind("text-lg font-semibold mb-2")}>
          Contact Information
        </Text>
        <Text>Email: support@petpalsconnect.com</Text>
        <Text>Phone: 123-456-7890</Text>
      </View>
    </ScrollView>
  );
};

export default HelpSupportScreen;
