// actions.js
import api from "../api/axios";
import { getStoredToken } from "../../utils/tokenutil";

// Action type constants. reducers.js imports START_LOADING, END_LOADING and
// SET_ERROR by name; they were never exported, so every `case START_LOADING:`
// compiled to `case undefined:` and the loading/error branches never ran.
export const START_LOADING = "START_LOADING";
export const END_LOADING = "END_LOADING";
export const SET_ERROR = "SET_ERROR";
export const CLEAR_ERROR = "CLEAR_ERROR";

export const startLoading = () => ({ type: START_LOADING });
export const endLoading = () => ({ type: END_LOADING });
export const setError = (error) => ({ type: SET_ERROR, payload: error });

export const clearError = () => ({
  type: CLEAR_ERROR,
});

export const setUser = (user) => {
  return {
    type: "SET_USER",
    payload: user,
  };
};

export const setUserId = (userId) => {
  return {
    type: "SET_USER_ID",
    payload: userId,
  };
};

// Chat Actions
export const setChatId = (chatId) => ({
  type: "SET_CHAT_ID",
  payload: chatId,
});

export const setChat = (chat) => ({
  type: "SET_CHAT",
  payload: chat,
});

export const updateChatMessages = (messages) => ({
  type: "UPDATE_CHAT_MESSAGES",
  payload: messages,
});

export const setAllChats = (chats) => ({
  type: "SET_ALL_CHATS",
  payload: chats,
});

// Pet Actions
export const setPets = (pets) => {
  return {
    type: "SET_PETS",
    payload: pets,
  };
};

export const FETCH_PLAYDATE_DETAILS_REQUEST = "FETCH_PLAYDATE_DETAILS_REQUEST";
export const FETCH_PLAYDATE_DETAILS_SUCCESS = "FETCH_PLAYDATE_DETAILS_SUCCESS";
export const FETCH_PLAYDATE_DETAILS_FAILURE = "FETCH_PLAYDATE_DETAILS_FAILURE";

export const FETCH_PLAYDATES_START = "FETCH_PLAYDATES_START";
export const FETCH_PLAYDATES_SUCCESS = "FETCH_PLAYDATES_SUCCESS";
export const FETCH_PLAYDATES_FAIL = "FETCH_PLAYDATES_FAIL";

// Action creators for playdates
export const fetchPlaydatesStart = () => ({
  type: FETCH_PLAYDATES_START,
});

export const fetchPlaydatesSuccess = (playdates) => ({
  type: FETCH_PLAYDATES_SUCCESS,
  payload: playdates,
});

export const fetchPlaydatesFail = (error) => ({
  type: FETCH_PLAYDATES_FAIL,
  payload: error,
});

export const fetchPlaydates = (userId) => {
  return async (dispatch) => {
    dispatch(fetchPlaydatesStart());
    try {
      const token = await getStoredToken();
      const response = await api.get(`/api/playdates/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      dispatch(fetchPlaydatesSuccess(response.data));
    } catch (error) {
      dispatch(fetchPlaydatesFail(error.message));
    }
  };
};

export const fetchPlaydateDetails = (playdateId) => async (dispatch) => {
  try {
    dispatch({ type: "FETCH_PLAYDATE_DETAILS_START" });

    const token = await getStoredToken();
    const response = await api.get(`/api/playdates/${playdateId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    dispatch({
      type: "FETCH_PLAYDATE_DETAILS_SUCCESS",
      payload: response.data,
    });
  } catch (error) {
    dispatch({
      type: "FETCH_PLAYDATE_DETAILS_FAIL",
      payload: error,
    });
    console.error("Error fetching playdate details:", error);
  }
};

// Notifications Actions

export const SET_NOTIFICATIONS = "SET_NOTIFICATIONS";
export const ADD_NOTIFICATION = "ADD_NOTIFICATION";
export const SET_UNREAD_COUNT = "SET_UNREAD_COUNT";
export const MARK_NOTIFICATIONS_READ = "MARK_NOTIFICATIONS_READ";

export const setNotifications = (notifications) => ({
  type: SET_NOTIFICATIONS,
  payload: notifications,
});

export const addNotification = (notification) => ({
  type: ADD_NOTIFICATION,
  payload: notification,
});

/**
 * The badge count, kept in the store rather than in the tab icon.
 *
 * The icon derived it from `state.notifications` - the whole slice object, not
 * the array inside it - and called `.some` on it, so the tab bar threw as soon
 * as it rendered. It also read `notification.read` and `createdAt`, neither of
 * which is a field: the schema has `readStatus` and `timestamp`.
 */
export const setUnreadCount = (unread) => ({
  type: SET_UNREAD_COUNT,
  payload: unread,
});

/** Marks everything read locally, so the badge clears without a refetch. */
export const markNotificationsRead = () => ({
  type: MARK_NOTIFICATIONS_READ,
});
