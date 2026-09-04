import React, { useCallback, useState } from "react";
import { Alert } from "react-native";

import { ActionSheet, useToast } from "./ui";
import { fetchChatMedia, leaveGroup, muteGroup } from "../api/chats";

/**
 * The "..." menu on a group conversation.
 *
 * The same three failures as the one-to-one sheet - an unawaited token, a
 * press event passed where a token was expected, errors that only reached a
 * console - plus one of its own: "Leave Group" sent `userId` from the client
 * to a handler that pulled *that* id out of the participants, so it was
 * "remove anybody from any group" rather than "leave". The server takes the
 * caller from the token now and this sends only the chat.
 *
 * Leaving is the one item here that cannot be undone from this screen, so it
 * asks first. That is what `Alert` is for; everything else reports through a
 * toast.
 */
const GroupOptionsModal = ({ isVisible, onClose, navigation, groupId }) => {
  const toast = useToast();
  const [muted, setMuted] = useState(false);

  const onMute = useCallback(async () => {
    try {
      const next = await muteGroup(groupId, !muted);
      setMuted(next);
      toast.success(next ? "Muted this group" : "Notifications back on");
    } catch (error) {
      console.warn("[groupchat] Could not change mute:", error.message);
      toast.error("Couldn't change notifications for this group.");
    }
  }, [groupId, muted, toast]);

  const onViewMedia = useCallback(async () => {
    try {
      const media = await fetchChatMedia(groupId, { group: true });
      if (media.length === 0) {
        toast.show("Nothing has been shared in this group yet.");
        return;
      }
      navigation.navigate("MediaView", { media });
    } catch (error) {
      console.warn("[groupchat] Could not load media:", error.message);
      toast.error("Couldn't load this group's media.");
    }
  }, [groupId, navigation, toast]);

  const onLeave = useCallback(() => {
    Alert.alert(
      "Leave this group?",
      "You'll stop receiving its messages. Somebody in the group can add you back.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              await leaveGroup(groupId);
              // "ChatsList" is not a registered route; leaving returns to the
              // Chats tab.
              navigation.navigate("Chats");
            } catch (error) {
              console.warn("[groupchat] Could not leave:", error.message);
              toast.error("Couldn't leave this group.");
            }
          },
        },
      ]
    );
  }, [groupId, navigation, toast]);

  return (
    <ActionSheet
      testID="group-options-sheet"
      visible={isVisible}
      onClose={onClose}
      items={[
        {
          label: muted ? "Unmute notifications" : "Mute notifications",
          icon: muted ? "notifications-outline" : "notifications-off-outline",
          testID: "group-option-mute",
          onPress: onMute,
          disabled: !groupId,
        },
        {
          label: "View media",
          icon: "images-outline",
          testID: "group-option-media",
          onPress: onViewMedia,
          disabled: !groupId,
        },
        {
          label: "Leave group",
          icon: "exit-outline",
          tone: "danger",
          testID: "group-option-leave",
          onPress: onLeave,
          disabled: !groupId,
        },
      ]}
    />
  );
};

export default GroupOptionsModal;
