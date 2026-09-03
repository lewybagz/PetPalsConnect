const mongoose = require("mongoose");
const env = require("./env");

// Mongoose 8+ enables useNewUrlParser/useUnifiedTopology internally; passing
// them now emits deprecation warnings, so they are intentionally omitted.
const connect = async () => {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("connected", () => console.log("[db] MongoDB connected"));
  mongoose.connection.on("error", (err) => console.error("[db] MongoDB error:", err.message));
  mongoose.connection.on("disconnected", () => console.warn("[db] MongoDB disconnected"));

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });
};

const disconnect = () => mongoose.connection.close(false);

module.exports = { connect, disconnect, mongoose };
