// RealmServiceModel.js
import Realm from "realm";

class Service extends Realm.Object {}
Service.schema = {
  name: "Service",
  primaryKey: "_id",
  properties: {
    _id: "objectId",
    contactInfo: "string",
    location: "string",
    name: "string",
    serviceType: "string",
    creator: "objectId", // Reference to User
    // Additional properties as needed
  },
};

export { Service };
