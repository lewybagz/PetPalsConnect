const mongoose = require("mongoose");
const localDbUri = "mongodb://localhost:27017/PetPalsConnect";

const connectDB = async () => {
  try {
    await mongoose.connect(localDbUri);
    console.log("Connected to MongoDB locally");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

module.exports = connectDB;
