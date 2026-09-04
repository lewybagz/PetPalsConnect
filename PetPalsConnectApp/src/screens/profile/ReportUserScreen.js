import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTailwind } from "../../styles/tailwind";
import { REPORT_REASONS, reportUser } from "../../api/safety";

/**
 * Reporting somebody.
 *
 * The old screen posted `{ Content, ReportedUser, Reporter, Status }` to a
 * lowercase schema, so strict mode dropped all four keys and the save failed on
 * the required fields - though it never got that far, because the controller
 * threw a TDZ error on its first line. Not one report has ever been filed.
 *
 * It also asked for free text and nothing else, sent `Status` from the client,
 * and offered "Block User" as an afterthought in the success dialog - which
 * could fail on its own, leaving somebody who had just said they felt unsafe
 * still looking at the person.
 *
 * Now: a reason, a description, and one request. The server blocks as part of
 * filing, so the two cannot come apart.
 */
const ReportUserScreen = ({ route, navigation }) => {
  const tailwind = useTailwind();

  const userId = route?.params?.userId;
  const name = route?.params?.name ?? "this person";
  const contentType = route?.params?.contentType ?? "user";
  const reportedContent = route?.params?.reportedContent;

  const [reason, setReason] = useState(null);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const description = content.trim();

    if (!reason) {
      Alert.alert("Pick a reason", "Tell us what kind of problem this is.");
      return;
    }
    if (description.length < 5) {
      Alert.alert(
        "Tell us what happened",
        "A sentence is enough, but we need something to go on."
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await reportUser({
        userId,
        reason,
        content: description,
        contentType,
        reportedContent,
      });

      Alert.alert(
        "Thanks for telling us",
        result?.blocked
          ? `We're looking into it. ${name} has been blocked, so you won't see them again.`
          : "We're looking into it.",
        [{ text: "Done", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert(
        "That didn't send",
        error.response?.data?.message ?? "Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!userId) {
    return (
      <View
        testID="report-missing"
        style={tailwind("flex-1 items-center justify-center p-8")}
      >
        <Text style={tailwind("text-base text-gray-500 text-center")}>
          There&apos;s nobody to report here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView testID="report-user" contentContainerStyle={tailwind("p-4 pb-10")}>
      <Text style={tailwind("text-xl font-bold text-gray-900")}>
        Report {name}
      </Text>
      <Text style={tailwind("text-sm text-gray-500 mt-1 mb-5")}>
        Reports are private. Reporting someone also blocks them.
      </Text>

      <Text style={tailwind("text-sm font-semibold text-gray-700 mb-2")}>
        What&apos;s the problem?
      </Text>

      {REPORT_REASONS.map((option) => {
        const chosen = reason === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            testID={`report-reason-${option.value}`}
            accessibilityState={{ selected: chosen }}
            onPress={() => setReason(option.value)}
            style={tailwind(
              `flex-row items-center border rounded-xl p-3 mb-2 ${
                chosen ? "border-blue-600 bg-blue-50" : "border-gray-200"
              }`
            )}
          >
            <Ionicons
              name={chosen ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={chosen ? "#2563eb" : "#9ca3af"}
            />
            <Text style={tailwind("text-base text-gray-800 ml-3 flex-1")}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}

      <Text style={tailwind("text-sm font-semibold text-gray-700 mt-5 mb-2")}>
        What happened?
      </Text>
      <TextInput
        testID="report-content"
        style={tailwind("border border-gray-200 rounded-xl p-3 h-32 text-base")}
        placeholder="A sentence or two is plenty."
        value={content}
        onChangeText={setContent}
        multiline
        textAlignVertical="top"
        maxLength={1000}
        editable={!submitting}
      />

      {submitting ? (
        <View testID="report-submitting" style={tailwind("py-6 items-center")}>
          <ActivityIndicator />
        </View>
      ) : (
        <TouchableOpacity
          testID="report-submit"
          onPress={submit}
          style={tailwind("bg-red-600 rounded-xl py-4 items-center mt-5")}
        >
          <Text style={tailwind("text-white font-semibold text-base")}>
            Report and block
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        testID="report-cancel"
        onPress={() => navigation.goBack()}
        style={tailwind("py-4 items-center")}
      >
        <Text style={tailwind("text-gray-500")}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default ReportUserScreen;
