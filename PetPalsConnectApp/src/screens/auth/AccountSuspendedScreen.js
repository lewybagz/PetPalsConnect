import React, { useState } from "react";
import { Alert, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import api from "../../api/axios";
import { Button, Card, Screen, Text, useToast } from "../../components/ui";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useTokens } from "../../context/AppThemeContext";
import { useTailwind } from "../../styles/tailwind";

/**
 * What a suspended account sees instead of the app.
 *
 * The API refuses a suspended account nearly every route, so without this
 * screen the app rendered its normal tree and every screen became a failed
 * request and a toast that said nothing about why. A person in this position
 * needs three things and the old behaviour gave none of them: to know what has
 * happened, to be able to say something about it, and to be able to leave.
 *
 * The copy is deliberately neutral. An automatic suspension is what several
 * people reported, not a finding - three of them is the threshold, and three
 * people can be wrong or coordinated. Nothing here says the account did
 * anything, and nothing names or counts the reporters: that would be a nudge
 * towards working out who, which is the last thing this situation needs.
 */
const AccountSuspendedScreen = () => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();
  const { profile, signOut, deleteAccount, refresh } = useAuthSession();

  const [appealing, setAppealing] = useState(false);
  const [appealed, setAppealed] = useState(false);

  const since = profile?.suspendedAt
    ? new Date(profile.suspendedAt).toLocaleDateString()
    : null;

  const sendAppeal = async () => {
    setAppealing(true);
    try {
      // The one route a suspended account keeps that reaches anybody: it goes
      // to the operator, never to another user.
      // Only `message`: the name and the email come from the verified token, so
      // a support ticket cannot be filed under somebody else's address.
      await api.post("/api/supportmessages", {
        message:
          "Account review requested. I don't believe this restriction is correct.",
      });
      setAppealed(true);
      toast.success("Sent. We'll be in touch by email.");
    } catch {
      toast.error("Couldn't send that just now. Try again in a moment.");
    } finally {
      setAppealing(false);
    }
  };

  const confirmDelete = () => {
    // One of the fourteen Alerts left in the app, and it qualifies: permanent,
    // and it offers a way out.
    Alert.alert(
      "Delete your account?",
      "This removes your profile, your pets and your messages. It cannot be undone.",
      [
        { text: "Keep my account", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
            } catch {
              toast.error("Couldn't delete the account. Try again in a moment.");
            }
          },
        },
      ]
    );
  };

  return (
    <Screen testID="account-suspended" scroll edges={["top", "bottom"]}>
      <View style={tailwind("items-center mt-xl mb-lg")}>
        <View
          style={[
            tailwind("bg-warningSoft items-center justify-center mb-lg"),
            { width: 72, height: 72, borderRadius: 36 },
          ]}
        >
          <Ionicons name="time-outline" size={34} color={tokens.warning} />
        </View>

        <Text variant="display" align="center">
          Your account is under review
        </Text>
      </View>

      <Text tone="muted" align="center" style={tailwind("mb-xl")}>
        PetPals Connect has paused this account while we take a look
        {since ? ` — since ${since}` : ""}. Your profile is hidden and you
        can&apos;t message other members in the meantime.
      </Text>

      <Card style={tailwind("mb-lg")}>
        <Text variant="label" style={tailwind("mb-sm")}>
          What happens next
        </Text>
        <Text tone="muted">
          Someone will review the account and email you at{" "}
          <Text>{profile?.email ?? "your registered address"}</Text>. Nothing is
          deleted while it is under review, and your pets and messages are
          exactly as you left them.
        </Text>
      </Card>

      <Card style={tailwind("mb-lg")}>
        <Text variant="label" style={tailwind("mb-sm")}>
          Think this is a mistake?
        </Text>
        <Text tone="muted" style={tailwind("mb-lg")}>
          Ask for it to be looked at again and we&apos;ll get back to you.
        </Text>

        <Button
          testID="suspended-appeal"
          title={appealed ? "Review requested" : "Ask for a review"}
          variant={appealed ? "secondary" : "primary"}
          loading={appealing}
          disabled={appealed}
          onPress={sendAppeal}
        />
      </Card>

      <Button
        testID="suspended-refresh"
        title="Check again"
        variant="ghost"
        onPress={refresh}
        style={tailwind("mb-sm")}
      />
      <Button
        testID="suspended-sign-out"
        title="Sign out"
        variant="ghost"
        onPress={signOut}
        style={tailwind("mb-sm")}
      />
      <Button
        testID="suspended-delete"
        title="Delete my account"
        // Outlined, not filled: it is the last resort here, not the thing we
        // want somebody to reach for.
        variant="dangerOutline"
        onPress={confirmDelete}
      />
    </Screen>
  );
};

export default AccountSuspendedScreen;
