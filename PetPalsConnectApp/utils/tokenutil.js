// tokenUtil.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
export const getStoredToken = async () => {
  try {
    const token = await AsyncStorage.getItem("userToken");
    return token;
  } catch (error) {
    console.error("Error getting stored token:", error);
    return null;
  }
};

export const sendTokenToServer = async (deviceToken) => {
  try {
    const userToken = await getStoredToken();
    if (!userToken) throw new Error("User token not available");

    const response = await axios.post(
      "/api/notifications/device-token",
      {
        deviceToken,
      },
      {
        headers: {
          Authorization: `Bearer ${userToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Token sent to server:", response.data);
  } catch (error) {
    console.error("Error sending token to server:", error);
  }
};
