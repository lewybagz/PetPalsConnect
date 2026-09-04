import React, { useCallback, useState } from "react";

import { ActionSheet, useToast } from "./ui";
import { fetchChatMedia, muteChat } from "../api/chats";

/**
 * The "..." menu on a one-to-one conversation.
 *
 * Both items were broken in ways nothing showed. "Mute Notifications" called
 * `/api/groupchats/toggle-mute` - the *group* endpoint - with a one-to-one
 * chat's id, and passed `userId` from the client, which the server does not
 * accept; the handler it reached read `chat.UserSettings`, which is not a path
 * on that schema, and threw. "View Media" logged "No media available for this
 * chat" to a console nobody is reading when the list came back empty.
 *
 * Both also called `getStoredToken()` without awaiting it and passed the
 * result as an Authorization header - which the shared client already sets -
 * and were wired as `onPress={handler}`, so the first argument was the press
 * event where a token was expected.
 */
const ChatOptionsModal = ({ isVisible, onClose, navigation, chatId }) => {
  const toast = useToast();
  const [muted, setMuted] = useState(false);

  const onMute = useCallback(async () => {
    try {
      const next = await muteChat(chatId, !muted);
      setMuted(next);
      toast.success(next ? "Muted this conversation" : "Notifications back on");
    } catch (error) {
      console.warn("[chat] Could not change mute:", error.message);
      toast.error("Couldn't change notifications for this chat.");
    }
  }, [chatId, muted, toast]);

  const onViewMedia = useCallback(async () => {
    try {
      const media = await fetchChatMedia(chatId);
      if (media.length === 0) {
        toast.show("Nothing has been shared in this chat yet.");
        return;
      }
      navigation.navigate("MediaView", { media });
    } catch (error) {
      console.warn("[chat] Could not load media:", error.message);
      toast.error("Couldn't load this chat's media.");
    }
  }, [chatId, navigation, toast]);

  return (
    <ActionSheet
      testID="chat-options-sheet"
      visible={isVisible}
      onClose={onClose}
      items={[
        {
          label: muted ? "Unmute notifications" : "Mute notifications",
          icon: muted ? "notifications-outline" : "notifications-off-outline",
          testID: "chat-option-mute",
          onPress: onMute,
          disabled: !chatId,
        },
        {
          label: "View media",
          icon: "images-outline",
          testID: "chat-option-media",
          onPress: onViewMedia,
          disabled: !chatId,
        },
      ]}
    />
  );
};

export default ChatOptionsModal;
