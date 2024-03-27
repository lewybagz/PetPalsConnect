// rootReducer.js
import { combineReducers } from "redux";

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

const rootReducer = combineReducers({
  user: userReducer,
  chat: chatReducer,
  pet: petReducer,
  // Add other reducers as needed
});

export default rootReducer;
