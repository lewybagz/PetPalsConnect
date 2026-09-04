import React, { useMemo, useState } from "react";
import { FlatList, TextInput, View } from "react-native";

import api from "../../api/axios";
import { Button, Card, Screen, Text, useToast } from "../../components/ui";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { radius } from "../../styles/tokens";

/**
 * Naming a new group.
 *
 * Four things stopped this working. `const [setChatId] = useState(null)`
 * destructures the *value* into a variable named like the setter, so
 * `dispatch(setChatId(id))` called `null(...)` and threw. The payload was
 * `{ GroupName, Participants, Creator }` against a lowercase schema, so strict
 * mode dropped all three. `Creator` was `auth.currentUser.uid` - a Firebase
 * uid where a Mongo user id belongs - and the server takes the creator from
 * the token anyway. And the "Initial Message" field was collected and never
 * sent anywhere.
 */
const GroupChatCreationScreen = ({ route, navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();

  const selectedPets = useMemo(
    () => route?.params?.selectedPets ?? [],
    [route?.params?.selectedPets]
  );

  const [groupName, setGroupName] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [creating, setCreating] = useState(false);

  /** The owners of the chosen pets - a group is people, not animals. */
  const participants = useMemo(
    () =>
      [
        ...new Set(
          selectedPets
            .map((pet) => pet?.owner?._id ?? pet?.owner)
            .filter(Boolean)
            .map(String)
        ),
      ],
    [selectedPets]
  );

  const createGroupChat = async () => {
    if (!groupName.trim()) {
      toast.error("Give the group a name first.");
      return;
    }
    if (participants.length === 0) {
      toast.error("Choose at least one pet to start a group with.");
      return;
    }

    setCreating(true);
    try {
      const { data } = await api.post("/api/groupchats/findOrCreate", {
        groupName: groupName.trim(),
        participants,
      });

      // The field existed and went nowhere; a group that opens with what you
      // meant to say is the whole point of collecting it.
      if (initialMessage.trim()) {
        await api
          .post("/api/groupchats/send", {
            groupId: data._id,
            text: initialMessage.trim(),
          })
          .catch((error) =>
            console.warn("[groupchat] Opening message failed:", error.message)
          );
      }

      navigation.navigate("GroupChat", { chatId: data._id });
    } catch (error) {
      console.warn("[groupchat] Could not create:", error.message);
      toast.error(
        error.response?.data?.message ?? "Couldn't create that group chat."
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Screen testID="group-chat-creation">
      <Text variant="title">New group</Text>

      <Text variant="caption" tone="muted" style={tailwind("mt-lg mb-sm")}>
        With
      </Text>
      <FlatList
        data={selectedPets}
        keyExtractor={(item, index) => String(item?._id ?? index)}
        renderItem={({ item }) => (
          <Card style={tailwind("mb-sm")}>
            <Text variant="body">{item?.name ?? "A pet"}</Text>
          </Card>
        )}
        ListEmptyComponent={
          <Text variant="body" tone="muted">
            No pets chosen yet.
          </Text>
        }
      />

      <TextInput
        testID="group-name"
        style={[
          tailwind("bg-surface border border-border text-text p-md mt-lg"),
          { borderRadius: radius.control },
        ]}
        placeholder="Group name"
        placeholderTextColor={tokens.textFaint}
        value={groupName}
        onChangeText={setGroupName}
        editable={!creating}
      />

      <TextInput
        testID="group-first-message"
        style={[
          tailwind("bg-surface border border-border text-text p-md mt-md"),
          { borderRadius: radius.control, minHeight: 88, textAlignVertical: "top" },
        ]}
        placeholder="Say something to start it off (optional)"
        placeholderTextColor={tokens.textFaint}
        value={initialMessage}
        onChangeText={setInitialMessage}
        editable={!creating}
        multiline
      />

      <View style={tailwind("mt-lg")}>
        <Button
          testID="create-group"
          title="Create group"
          onPress={createGroupChat}
          loading={creating}
        />
      </View>
    </Screen>
  );
};

export default GroupChatCreationScreen;
