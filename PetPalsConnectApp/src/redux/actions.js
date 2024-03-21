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
export const setChatId = (chatId) => {
  return {
    type: "SET_CHAT_ID",
    payload: chatId,
  };
};

// Pet Actions
export const setPets = (pets) => {
  return {
    type: "SET_PETS",
    payload: pets,
  };
};

// Add other actions as needed
