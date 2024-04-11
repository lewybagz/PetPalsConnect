const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const { ServerApiVersion } = require("mongoose");
const authenticate = require("./middleware/authenticate");
const cron = require("node-cron");
// TODO: FINISH
const { updateLocations } = require("./controllers/LocationController");

const cors = require("cors");

require("dotenv").config();

const uri = process.env.MONGODB_URI;

// Connect to MongoDB with Mongoose
mongoose
  .connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
  })
  .then(() => {
    console.log("Successfully connected to MongoDB using Mongoose!");
  })
  .catch((err) => {
    console.error("Connection error", err.message);
  });

// Initialize express app
const app = express();

// Use bodyParser to parse application/json
app.use(bodyParser.json());

// Enable CORS
app.use(cors());

// Protected Routes
app.use("/api/articles", authenticate, require("./routes/articles"));
app.use("/api/pets", authenticate, require("./routes/pets"));
app.use(
  "/api/userpreferences",
  authenticate,
  require("./routes/userPreferences")
);
app.use("/api/events", authenticate, require("./routes/events"));
app.use("/api/favorites", authenticate, require("./routes/favorites"));
app.use("/api/groupchats", authenticate, require("./routes/groupChats"));
app.use("/api/messages", authenticate, require("./routes/messages"));
app.use("/api/petmatches", authenticate, require("./routes/petMatches"));
app.use("/api/playdates", authenticate, require("./routes/playdates"));
app.use("/api/reviews", authenticate, require("./routes/reviews"));
app.use("/api/notifications", authenticate, require("./routes/notifications"));
app.use("/api/reports", authenticate, require("./routes/reports"));
app.use("/api/services", authenticate, require("./routes/services"));
app.use("/api/subscriptions", authenticate, require("./routes/subscriptions"));
app.use("/api/friends", authenticate, require("./routes/friends"));
app.use("/api/locations", authenticate, require("./routes/locations"));
app.use("/api/activitylogs", authenticate, require("./routes/activityLogs"));
app.use("/api/blocklists", authenticate, require("./routes/blockLists"));
app.use(
  "/api/friendrequests",
  authenticate,
  require("./routes/friendRequests")
);
app.use("/api/playdates", authenticate, require("./routes/playdates"));
app.use("/api/users", authenticate, require("./routes/users"));
app.use(
  "/api/stripe-webhooks",
  authenticate,
  require("./routes/stripeWebhooks")
);
app.use(
  "/api/subscription-history",
  authenticate,
  require("./routes/subscriptionHistory")
);
app.use("/api/payments", authenticate, require("./routes/payment"));
app.use("/api/media", authenticate, require("./routes/media"));

app.use((err, req, res) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

cron.schedule("0 0 1 * *", async () => {
  console.log("Running a job at the start of the month at midnight");
  await updateLocations();
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
