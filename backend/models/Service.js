const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for Service
const ServiceSchema = new Schema({
  ContactInfo: {
    type: String,
    required: true,
  },
  Location: {
    type: String, // Could be more complex, like an object with lat/lon if needed
    required: true,
  },
  Name: {
    type: String,
    required: true,
  },
  ServiceType: {
    type: String,
    required: true,
  },
  Creator: {
    type: Schema.Types.ObjectId,
    ref: "User", // Assuming 'User' is another schema/model
    required: true,
  },
  ModifiedDate: {
    type: Date,
    default: Date.now,
  },
  CreatedDate: {
    type: Date,
    default: Date.now,
  },
  Slug: String,
});

// Create a model
const Service = mongoose.model("Service", ServiceSchema);

module.exports = Service;
