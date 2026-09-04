import api from "./axios";

/**
 * The chat menus, from the app's side.
 *
 * Both option modals hand-rolled these calls, and every one of them was wrong
 * in a way nothing surfaced: `ChatOptionsModal` muted a *one-to-one* chat by
 * calling the group endpoint with the wrong id; both fetched a token with
 * `getStoredToken()` and then never awaited it, passing `undefined` as the
 * Authorization header the shared client already sets; and `onPress` handed the
 * press event in where a token was expected. Everything failed into a
 * `console.error` and the sheet closed as though it had worked.
 *
 * `leaveGroup` and `removeFriend` sent a `userId` from the client, which the
 * server no longer accepts - who you are comes from the token.
 */

/** Mutes or unmutes a one-to-one conversation, for this user only. */
export const muteChat = async (chatId, mute = true) => {
  const { data } = await api.post(`/api/chats/${chatId}/mute`, { mute });
  return Boolean(data?.muted);
};

/** Mutes or unmutes a group, for this user only. */
export const muteGroup = async (chatId, mute = true) => {
  const { data } = await api.put("/api/groupchats/toggle-mute", { chatId, mute });
  return Boolean(data?.muted);
};

/** Everything shared in a conversation. `group` picks which collection. */
export const fetchChatMedia = async (chatId, { group = false } = {}) => {
  const { data } = await api.get(
    group ? `/api/groupchats/${chatId}/media` : `/api/chats/${chatId}/media`
  );
  return Array.isArray(data?.media) ? data.media : [];
};

/** Leaves a group. Removes the caller and nobody else. */
export const leaveGroup = async (chatId) => {
  await api.post("/api/groupchats/leave", { chatId });
};
