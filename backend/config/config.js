// config.js
require("dotenv").config();
const fs = require("fs");

const rawConfig = fs.readFileSync("path/to/your/json/file.json");
let config = JSON.parse(rawConfig);

config.private_key_id = process.env.GOOGLE_CLOUD_PRIVATE_KEY_ID;
config.private_key = process.env.GOOGLE_CLOUD_PRIVATE_KEY.replace(/\\n/g, "\n");
config.mongoUri = process.env.MONGODB_URI; // Add this line for MongoDB URI

module.exports = config;
