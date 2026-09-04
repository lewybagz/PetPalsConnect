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
import { useToast } from "../../components/ui";
import { useTokens } from "../../context/AppThemeContext";
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
  const tokens = useTokens();
  const toast = useToast();

  const userId = route?.params?.userId;
  const name = route?.params?.name ?? "this person";
  const contentType = route?.params?.contentType ?? "user";
  const reportedContent = route?.params?.reportedContent;

  const [reason, setReason] = useState(null);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const description = content.trim();

    // Nudges, not errors: a modal to say "pick one of the six things on the
    // screen in front of you" is an interruption, not help.
    if (!reason) {
      toast.warning("Pick a reason so we know what kind of problem this is.");
      return;
    }
    if (description.length < 5) {
      toast.warning("Tell us what happened - a sentence is plenty.");
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
      toast.error(error.response?.data?.message ?? "That didn't send. Please try again.");
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
        <Text style={tailwind("text-base text-textMuted text-center")}>
          There&apos;s nobody to report here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView testID="report-user" contentContainerStyle={tailwind("p-4 pb-10")}>
      <Text style={tailwind("text-xl font-bold text-text")}>
        Report {name}
      </Text>
      <Text style={tailwind("text-sm text-textMuted mt-1 mb-5")}>
        Reports are private. Reporting someone also blocks them.
      </Text>

      <Text style={tailwind("text-sm font-semibold text-textMuted mb-2")}>
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
                chosen ? "border-primary bg-primarySoft" : "border-border"
              }`
            )}
          >
            <Ionicons
              name={chosen ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={chosen ? tokens.primary : tokens.textFaint}
            />
            <Text style={tailwind("text-base text-text ml-3 flex-1")}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}

      <Text style={tailwind("text-sm font-semibold text-textMuted mt-5 mb-2")}>
        What happened?
      </Text>
      <TextInput
        testID="report-content"
        style={tailwind("border border-border rounded-xl p-3 h-32 text-base")}
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
          style={tailwind("bg-danger rounded-xl py-4 items-center mt-5")}
        >
          <Text style={tailwind("text-onPrimary font-semibold text-base")}>
            Report and block
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        testID="report-cancel"
        onPress={() => navigation.goBack()}
        style={tailwind("py-4 items-center")}
      >
        <Text style={tailwind("text-textMuted")}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default ReportUserScreen;
