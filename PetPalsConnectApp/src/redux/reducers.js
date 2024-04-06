// rootReducer.js
import { combineReducers } from "redux";
import { SET_NOTIFICATIONS, ADD_NOTIFICATION } from "./actions";

// TODO: ASK ABOUT WHEN TO USE EACH REDUCER

const initialUserState = {
  user: null,
  userId: null,
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
    default:
      return state;
  }
};

const initialChatState = {
  singleChatId: null,
  groupChatId: null,
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
    // ... other cases as needed
    default:
      return state;
  }
};

const petReducer = (state = {}, action) => {
  switch (action.type) {
    case "SET_PETS":
      return {
        ...state,
        pets: action.payload,
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
    default:
      return state;
  }
};

const initialNotificationsState = {
  notifications: [],
};

const notificationsReducer = (state = initialNotificationsState, action) => {
  switch (action.type) {
    case SET_NOTIFICATIONS:
      return {
        ...state,
        notifications: action.payload,
      };
    case ADD_NOTIFICATION:
      return {
        ...state,
        notifications: [...state.notifications, action.payload],
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
  // Add other reducers as needed
});

export default rootReducer;
