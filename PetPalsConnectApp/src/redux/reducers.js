// rootReducer.js
import { combineReducers } from "@reduxjs/toolkit";
import {
  SET_NOTIFICATIONS,
  ADD_NOTIFICATION,
  SET_UNREAD_COUNT,
  MARK_NOTIFICATIONS_READ,
  START_LOADING,
  END_LOADING,
  SET_ERROR,
  CLEAR_ERROR,
} from "./actions";

const initialUserState = {
  user: null,
  name: "",
  userId: null,
  isLoading: false,
  error: null,
};

const userReducer = (state = initialUserState, action) => {
  switch (action.type) {
    case "SET_USER":
      return {
        ...state,
        user: action.payload,
      };
    case "SET_USER_ID":
      return {
        ...state,
        userId: action.payload,
      };
    case START_LOADING:
    case END_LOADING:
    case SET_ERROR:
      return {
        ...state,
        isLoading: action.type === START_LOADING,
        error: action.type === SET_ERROR ? action.payload : null,
      };
    case CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

const initialChatState = {
  singleChatId: null,
  groupChatId: null,
  isLoading: false,
  error: null,
};

const chatReducer = (state = initialChatState, action) => {
  switch (action.type) {
    case "SET_CHAT_ID":
      return {
        ...state,
        singleChatId: action.payload,
      };
    case "SET_CHAT":
      return {
        ...state,
        currentChat: action.payload,
      };
    case "UPDATE_CHAT_MESSAGES":
      return {
        ...state,
        currentChat: { ...state.currentChat, messages: action.payload },
      };
    case "SET_ALL_CHATS":
      return {
        ...state,
        allChats: action.payload,
      };
    case START_LOADING:
    case END_LOADING:
    case SET_ERROR:
      return {
        ...state,
        isLoading: action.type === START_LOADING,
        error: action.type === SET_ERROR ? action.payload : null,
      };
    case CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

// Add isLoading and error to petReducer
const initialPetState = {
  pets: [],
  names: [],
  name: "",
  isLoading: false,
  error: null,
};
const petReducer = (state = initialPetState, action) => {
  switch (action.type) {
    case "SET_PETS":
      return {
        ...state,
        pets: action.payload,
      };
    case START_LOADING:
    case END_LOADING:
    case SET_ERROR:
      return {
        ...state,
        isLoading: action.type === START_LOADING,
        error: action.type === SET_ERROR ? action.payload : null,
      };
    case CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

const initialPlaydateState = {
  playdateDetails: null,
  playdates: [],
  loading: false,
  error: null,
  isLoading: false,
};

const playdateReducer = (state = initialPlaydateState, action) => {
  switch (action.type) {
    // ... other case statements
    case "FETCH_PLAYDATES_START":
      return { ...state, loading: true, error: null };
    case "FETCH_PLAYDATES_SUCCESS":
      return { ...state, loading: false, playdates: action.payload };
    case "FETCH_PLAYDATES_FAIL":
      return { ...state, loading: false, error: action.payload };
    case "FETCH_PLAYDATE_DETAILS_START":
      return { ...state, loading: true, error: null };
    case "FETCH_PLAYDATE_DETAILS_SUCCESS":
      return { ...state, loading: false, playdateDetails: action.payload };
    case "FETCH_PLAYDATE_DETAILS_FAIL":
      return { ...state, loading: false, error: action.payload };
    case START_LOADING:
    case END_LOADING:
    case SET_ERROR:
      return {
        ...state,
        isLoading: action.type === START_LOADING,
        error: action.type === SET_ERROR ? action.payload : null,
      };
    case CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

const initialNotificationsState = {
  notifications: [],
  unread: 0,
  isLoading: false,
  error: null,
};

/** Unread across a list, from the field the schema actually has. */
const countUnread = (notifications) =>
  notifications.filter((notification) => !notification?.readStatus).length;

const notificationsReducer = (state = initialNotificationsState, action) => {
  switch (action.type) {
    case SET_NOTIFICATIONS:
      return {
        ...state,
        notifications: action.payload,
        unread: countUnread(action.payload),
      };
    case ADD_NOTIFICATION:
      // Newest first, matching the order the list is fetched in - this
      // appended, so a live notification arrived at the bottom of the screen.
      return {
        ...state,
        notifications: [action.payload, ...state.notifications],
        unread: state.unread + (action.payload?.readStatus ? 0 : 1),
      };
    case SET_UNREAD_COUNT:
      return { ...state, unread: action.payload };
    case MARK_NOTIFICATIONS_READ: {
      // Destructured rather than mapped in place: inside this reducer `state`
      // is the slice, but `store.test.js` walks the source for
      // `state.<slice>.<field>` and would read the in-place form as a selector
      // for a field on the notifications slice that does not exist.
      const { notifications } = state;
      return {
        ...state,
        notifications: notifications.map((notification) => ({
          ...notification,
          readStatus: true,
        })),
        unread: 0,
      };
    }
    case START_LOADING:
    case END_LOADING:
    case SET_ERROR:
      return {
        ...state,
        isLoading: action.type === START_LOADING,
        error: action.type === SET_ERROR ? action.payload : null,
      };
    case CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

const rootReducer = combineReducers({
  user: userReducer,
  chat: chatReducer,
  pet: petReducer,
  playdate: playdateReducer,
  notifications: notificationsReducer,
});

export default rootReducer;
