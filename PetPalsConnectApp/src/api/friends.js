import api from "./axios";

/**
 * Friends, from the app's side.
 *
 * Two cards - `UserPetCardComponent` and `SwipeableUserPetCard` - had an "Add
 * Friend" item that posted `{ senderId, recipientId }` to `POST /api/friends`.
 * That is the wrong endpoint (it writes a *friendship*, not a request), the
 * keys are not paths on the schema so strict mode dropped them, and the row
 * then failed on its three required fields. Both then showed "Friend Request
 * Sent" for a 400. The server refuses that door now and this asks the right
 * one.
 */

/** Asks somebody to be friends. The sender comes from the token. */
export const sendFriendRequest = async (userId) => {
  const { data } = await api.post("/api/friendrequests", { receiver: userId });
  return data;
};

/** Accepts an invitation. Only the person invited may. */
export const acceptFriendRequest = async (requestId) => {
  const { data } = await api.put(`/api/friendrequests/${requestId}/accept`);
  return data;
};

/** Declines one, so the sender is not left waiting for an answer. */
export const declineFriendRequest = async (requestId) => {
  const { data } = await api.put(`/api/friendrequests/${requestId}/decline`);
  return data;
};

/** Everyone the caller is friends with, as Friend rows with both sides filled. */
export const fetchFriends = async () => {
  const { data } = await api.get("/api/friends");
  return Array.isArray(data) ? data : [];
};

/**
 * Unfriends somebody, addressed by them rather than by the relationship row.
 *
 * There was no endpoint for this and no caller: the swipe-to-remove action on
 * the friends list was `console.log("Remove friend action")`.
 */
export const removeFriend = async (userId) => {
  await api.delete(`/api/friends/${userId}`);
};

/**
 * The pets belonging to the caller's friends.
 *
 * Was `GET /api/friends/${userPetId}/pets` - a pet id in a slot the server
 * matched against *user* ids, on a handler that also filtered by a field that
 * does not exist. It could only ever return an empty list, which is what the
 * playdate pet picker showed.
 */
export const fetchFriendsPets = async () => {
  const { data } = await api.get("/api/friends/pets");
  return Array.isArray(data) ? data : [];
};

/** The other person in a friendship row, whichever side the caller is on. */
export const otherSide = (friendship, myUserId) => {
  const first = friendship?.user1;
  const second = friendship?.user2;
  return String(first?._id ?? first) === String(myUserId) ? second : first;
};
