// tokenUtil.js
import AsyncStorage from "@react-native-async-storage/async-storage";

export const getStoredToken = async () => {
  try {
    const token = await AsyncStorage.getItem("userToken");
    return token;
  } catch (error) {
    console.error("Error getting stored token:", error);
    return null;
  }
};
