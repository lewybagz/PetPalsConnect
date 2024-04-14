// userService.js
const User = require("../models/User");
import axios from "axios";
import { getStoredToken } from "../utils/tokenutil";

const findUserById = async (userId) => {
  try {
    const user = await User.findById(userId).populate("pets").exec();
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  } catch (error) {
    console.error(`Error finding user by ID: ${userId}`, error);
    throw error;
  }
};

const fetchUserPreferences = async (userId) => {
  try {
    const token = await getStoredToken();
    const response = await axios.get(`/api/userpreferences/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching user preferences:", error);
    return null;
  }
};

module.exports = { findUserById, fetchUserPreferences };
