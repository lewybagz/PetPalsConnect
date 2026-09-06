import React, { useState } from "react";
import { TextInput, View } from "react-native";
import { getAuth } from "@react-native-firebase/auth";

import api from "../../api/axios";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { useAuthSession } from "../../context/AuthSessionContext";
import { Button, Card, Screen, Text, useToast } from "../../components/ui";

/**
 * The account, as opposed to the profile people see.
 *
 * This screen read and wrote `users/{uid}` in **Firestore**, which is the one
 * store this app deliberately does not have: Mongo is the source of truth and
 * Firebase is auth, push and file storage only. Nothing has written a Firestore
 * user document since that decision, so the read always missed and told the
 * owner "we couldn't find your profile", and `updateDoc` wrote into a
 * collection nothing reads. It also mixed the `firebase/firestore` web SDK with
 * `@react-native-firebase/auth`, so two Firebase SDKs were initialised side by
 * side.
 *
 * What it edited could not work either. `phone` is not a field on `User` at
 * all, and `email` belongs to Firebase Auth - the server derives it from the
 * verified token when the profile is created, so a copy edited here would only
 * drift from the address you actually sign in with.
 *
 * So the screen shows the account facts, and edits the one thing that is
 * genuinely the owner's to change: their username. Email and sign-in method
 * are shown as what they are - facts owned by Firebase Auth - rather than as
 * inputs that pretend to save.
 */
const AccountInformationScreen = () => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();
  const { profile, refresh } = useAuthSession();

  const [username, setUsername] = useState(profile?.username ?? "");
  const [saving, setSaving] = useState(false);

  const firebaseUser = getAuth().currentUser;
  const changed = username.trim() !== (profile?.username ?? "");

  const save = async () => {
    if (!changed || !profile?._id) return;

    setSaving(true);
    try {
      await api.patch(`/api/users/${profile._id}`, { username: username.trim() });
      // The session holds the profile, so re-reading it is what makes the new
      // name appear everywhere rather than only here.
      await refresh();
      toast.success("Saved");
    } catch (error) {
      // The server answers 409 for a name somebody holds and 400 with a reason
      // for one that breaks the rules, and both are worth showing as written.
      toast.error(error.response?.data?.message ?? "Couldn't save that. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen testID="account-information" scroll>
      <Text variant="title" style={tailwind("mb-md")}>
        Account
      </Text>

      <Text variant="caption" tone="muted" style={tailwind("mb-xs")}>
        USERNAME
      </Text>
      <TextInput
        testID="account-username"
        style={tailwind(
          "border border-border rounded-lg px-3 py-3 mb-xs text-base text-text bg-surface"
        )}
        // Without this the input renders the platform's default text colour,
        // which is black - invisible on a dark surface.
        placeholderTextColor={tokens.textFaint}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
        editable={!saving}
        placeholder="username"
      />
      <Text variant="caption" tone="faint" style={tailwind("mb-lg")}>
        3 to 20 characters. Letters, numbers and underscores.
      </Text>

      <Button
        testID="account-save"
        title={saving ? "Saving…" : "Save"}
        disabled={!changed || saving}
        onPress={save}
      />

      {/*
        Shown rather than edited. Firebase Auth owns both, and the server takes
        the email from the verified token - an editable copy here could only
        ever disagree with the address you sign in with.
      */}
      <Text variant="title" style={tailwind("mt-xl mb-sm")}>
        Sign-in
      </Text>
      <Card testID="account-signin">
        <Row label="Email" value={firebaseUser?.email ?? profile?.email ?? "—"} />
        {firebaseUser?.phoneNumber ? (
          <Row label="Phone" value={firebaseUser.phoneNumber} />
        ) : null}
        <Text variant="caption" tone="faint" style={tailwind("mt-sm")}>
          These come from how you sign in, and are managed by your sign-in
          provider rather than here.
        </Text>
      </Card>
    </Screen>
  );
};

const Row = ({ label, value }) => {
  const tailwind = useTailwind();
  return (
    <View style={tailwind("flex-row justify-between items-center py-xs")}>
      <Text tone="muted">{label}</Text>
      <Text weight="600" style={tailwind("flex-1 text-right ml-md")}>
        {value}
      </Text>
    </View>
  );
};

export default AccountInformationScreen;
