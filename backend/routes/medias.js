const express = require("express");
const app = express();
const mediaRoutes = require("./routes/mediaRoutes"); // Adjust the path to your mediaRoutes

// Use mediaRoutes with '/api/media' prefix
app.use("/", mediaRoutes);

app.listen(/* ... */);
