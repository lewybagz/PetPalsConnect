import React, { useState } from "react";
import { ScrollView, TextInput, View } from "react-native";

import { Button, Card, Screen, Text, useToast } from "../../components/ui";
import api from "../../api/axios";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { radius, space } from "../../styles/tokens";

/**
 * Getting in touch.
 *
 * The submit button was `onPress={() => submitForm(FormData)}` - the global
 * `FormData` *constructor*, not the three fields above it - so every request
 * body serialised to `{}` and no support message has ever contained anything.
 * It then checked `response.status === 200` while the server answers 201, so a
 * successful send showed "There was an issue sending your message."
 *
 * The name and email fields are gone: they were sent to the server, which used
 * the address to send a confirmation email, so anyone with an account could
 * make this app email arbitrary text to an arbitrary address. Both come from
 * the signed-in profile now.
 */

const FAQS = [
  {
    question: "How do I change my pet's profile?",
    answer: "Open Pets from the More tab, choose your pet, and tap Edit.",
  },
  {
    question: "Can I cancel a playdate?",
    answer: "Yes — open the playdate and choose Cancel. Everyone invited is told.",
  },
  {
    question: "Someone is making me uncomfortable.",
    answer:
      "Use Report on their card or in the chat header. Reporting blocks them at " +
      "the same time, so you will not see them again while we look.",
  },
  {
    question: "I found a bug.",
    answer: "Tell us below — what you were doing and what happened is plenty.",
  },
];

const HelpSupportScreen = () => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const text = message.trim();
    if (!text) {
      toast.error("Tell us what's happened first.");
      return;
    }

    setSending(true);
    try {
      await api.post("/api/supportmessages", { message: text });
      setMessage("");
      toast.success("Sent — we'll get back to you.");
    } catch (error) {
      console.warn("[support] Could not send:", error.message);
      toast.error("Couldn't send that. Try again in a moment.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen testID="help-support">
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text variant="title">Help &amp; support</Text>
        <Text variant="body" tone="muted" style={tailwind("mt-sm mb-lg")}>
          Tell us what&rsquo;s happened and we&rsquo;ll reply to the email on your
          account.
        </Text>

        <TextInput
          testID="support-message"
          style={[
            tailwind("bg-surface border border-border text-text p-md"),
            { borderRadius: radius.control, minHeight: 120, textAlignVertical: "top" },
          ]}
          value={message}
          onChangeText={setMessage}
          placeholder="What happened?"
          placeholderTextColor={tokens.textFaint}
          multiline
          editable={!sending}
        />

        <Button
          testID="support-submit"
          title="Send"
          onPress={submit}
          loading={sending}
          style={tailwind("mt-md")}
        />

        <Text variant="caption" tone="muted" style={tailwind("mt-xxl mb-sm")}>
          Common questions
        </Text>

        {FAQS.map((faq) => (
          <Card key={faq.question} style={tailwind("mb-sm")}>
            <Text variant="label">{faq.question}</Text>
            <Text variant="body" tone="muted" style={tailwind("mt-xs")}>
              {faq.answer}
            </Text>
          </Card>
        ))}

        <View style={{ height: space.xxl }} />
      </ScrollView>
    </Screen>
  );
};

export default HelpSupportScreen;
