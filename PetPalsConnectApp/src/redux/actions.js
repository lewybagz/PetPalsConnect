// actions.js
import axios from "axios";
import { getStoredToken } from "../../utils/tokenutil";
// User Actions
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

// Asynchronous action creator for fetching playdates
export const fetchPlaydates = () => {
  return async (dispatch) => {
    dispatch(fetchPlaydatesStart());
    try {
      const token = await getStoredToken();
      const response = await axios.get("/api/playdates/user", {
        headers: { Authorization: `Bearer ${token}` },
      });
      dispatch(fetchPlaydatesSuccess(response.data));
    } catch (error) {
      dispatch(fetchPlaydatesFail(error.message));
    }
  };
};

// In your actions.js or a similar file

export const fetchPlaydateDetails = (playdateId) => async (dispatch) => {
  try {
    dispatch({ type: "FETCH_PLAYDATE_DETAILS_START" });

    const token = await getStoredToken();
    const response = await axios.get(`/api/playdates/${playdateId}`, {
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

// Add other actions as needed
