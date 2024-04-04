// petService.js
import axios from "axios";

export const getPetOwner = async (petId) => {
  try {
    const response = await axios.get(`/api/pets/${petId}`);
    return response.data.owner._id; // Ensure your API returns the owner's ID
  } catch (error) {
    console.error("Error fetching pet owner:", error);
    return null; // Or handle error appropriately
  }
};
