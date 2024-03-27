// actions.js

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

// Add other actions as needed
