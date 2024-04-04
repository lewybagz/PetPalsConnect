const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for Service
const ServiceSchema = new Schema({
  contactInfo: {
    type: String,
    required: true,
  },
  location: {
    type: String, // Could be more complex, like an object with lat/lon if needed
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  serviceType: {
    type: String,
    required: true,
  },
  creator: {
    type: Schema.Types.ObjectId,
    ref: "User", // Assuming 'User' is another schema/model
    required: true,
  },
  modifiedDate: {
    type: Date,
    default: Date.now,
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
  slug: String,
});

// Create a model
const Service = mongoose.model("Service", ServiceSchema);

module.exports = Service;
