const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const stripeWebhooksRouter = require("./routes/stripeWebhooks");
const subscriptionHistoryRoutes = require("./routes/subscriptionHistory");
const { ServerApiVersion } = require("mongoose");

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

const playdateRoutes = require("./routes/playdates");

// Define routes
app.use("/api/articles", require("./routes/articles"));
app.use("/api/pets", require("./routes/pets"));
app.use("/api/users", require("./routes/users"));
app.use("/api/userpreferences", require("./routes/userPreferences"));
app.use("/api/subscriptions", require("./routes/subscriptions"));
app.use("/api/events", require("./routes/events"));
app.use("/api/favorites", require("./routes/favorites"));
app.use("/api/friends", require("./routes/friends"));
app.use("/api/groupchats", require("./routes/groupChats"));
app.use("/api/locations", require("./routes/locations"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/petmatches", require("./routes/petMatches"));
app.use("/api/playdates", require("./routes/playdates"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/services", require("./routes/services"));
app.use("/api/activitylogs", require("./routes/activityLogs"));
app.use("/api/blocklists", require("./routes/blockLists"));
app.use("/api/friendrequests", require("./routes/friendRequests"));
app.use("/api/playdates", playdateRoutes);
app.use("/api/stripe-webhooks", stripeWebhooksRouter);
app.use("/api/subscription-history", subscriptionHistoryRoutes);
app.use("/api/payments", require("./routes/payment"));

// Error handling middleware
app.use((err, req, res) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
