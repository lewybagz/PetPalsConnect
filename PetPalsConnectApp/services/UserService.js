import api from "../src/api/axios";

/**
 * User data access.
 *
 * This file used to require the backend's Mongoose User model, which cannot run
 * on a device, while the backend in turn imported this file. Both directions of
 * that cycle are gone: the app talks to the API, and the API talks to Mongo.
 */

/** The signed-in user's own profile, resolved from their Firebase token. */
export const fetchCurrentUser = async () => {
  const { data } = await api.get("/api/users/me");
  return data;
};

/** Creates the Mongo profile for a newly registered Firebase account. */
export const createUserProfile = async (profile) => {
  const { data } = await api.post("/api/users", profile);
  return data;
};

export const findUserById = async (userId) => {
  const { data } = await api.get(`/api/users/${userId}`);
  return data;
};

export const fetchUserPets = async (userId) => {
  const { data } = await api.get(`/api/users/pets/${userId}`);
  return data;
};

export const fetchUserPreferences = async (userId) => {
  try {
    const { data } = await api.get(`/api/userpreferences/${userId}`);
    return data;
  } catch (error) {
    console.warn("[user] Could not fetch preferences:", error.message);
    return null;
  }
};

export const updateUser = async (userId, updates) => {
  const { data } = await api.put(`/api/users/${userId}`, updates);
  return data;
};

export default {
  fetchCurrentUser,
  createUserProfile,
  findUserById,
  fetchUserPets,
  fetchUserPreferences,
  updateUser,
};
