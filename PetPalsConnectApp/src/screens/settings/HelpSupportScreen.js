import React, { useEffect, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";

import { Button, Card, Screen, Skeleton, Text, useToast } from "../../components/ui";
import AskSpotButton from "../../components/spot/AskSpotButton";
import api from "../../api/axios";
import { fetchHelp, groupByTopic } from "../../api/help";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { radius, space } from "../../styles/tokens";

/**
 * Getting in touch, and how the app works.
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
 *
 * The questions below come from the server's help table - the same one Spot
 * reads - cached like the toxin table so this screen works on the connection
 * that brought somebody here. Four used to live inline; a second copy is the
 * one that goes stale.
 */

const HelpSupportScreen = ({ navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [help, setHelp] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchHelp().then((table) => {
      if (!cancelled) setHelp(table);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const groups = help ? groupByTopic(help) : [];

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
          How PetPals works
        </Text>

        {help === null ? (
          <View testID="help-loading">
            <Skeleton height={72} style={tailwind("mb-sm")} />
            <Skeleton height={72} style={tailwind("mb-sm")} />
          </View>
        ) : groups.length === 0 ? (
          <Text tone="muted" testID="help-empty">
            The questions couldn&rsquo;t load. Ask Spot below, or tell us above.
          </Text>
        ) : (
          groups.map((group) => (
            <View key={group.key} testID={`help-topic-${group.key}`} style={tailwind("mb-md")}>
              <Text variant="label" style={tailwind("mb-sm")}>
                {group.label}
              </Text>
              {group.entries.map((entry) => (
                <Card key={entry.id} testID={`help-${entry.id}`} style={tailwind("mb-sm")}>
                  <Text weight="600">{entry.question}</Text>
                  <Text variant="body" tone="muted" style={tailwind("mt-xs")}>
                    {entry.answer}
                  </Text>
                  {entry.screen && entry.screen !== "HelpSupport" && navigation ? (
                    <Button
                      title="Open"
                      variant="ghost"
                      fullWidth={false}
                      testID={`help-open-${entry.id}`}
                      onPress={() => navigation.navigate(entry.screen)}
                      style={tailwind("mt-xs self-start")}
                    />
                  ) : null}
                </Card>
              ))}
            </View>
          ))
        )}

        {navigation ? (
          <AskSpotButton
            inline
            navigation={navigation}
            context={{ screen: "help" }}
            prefill="How does PetPals work?"
            label="Ask Spot"
          />
        ) : null}

        <View style={{ height: space.xxl }} />
      </ScrollView>
    </Screen>
  );
};

export default HelpSupportScreen;
