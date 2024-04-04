// RealmUserModel.js
import Realm from "realm";

class User extends Realm.Object {}
User.schema = {
  name: "User",
  primaryKey: "_id",
  properties: {
    _id: "objectId",
    fcmToken: "string?",
    friendsList: "objectId[]", // Array of User references
    location: "objectId?", // Reference to Location
    playdateRange: "string",
    notificationsEnabled: "bool",
    locationSharingEnabled: "bool",
    securityQuestions: "string[]?", // Store as JSON string and parse when needed
    pets: "objectId[]", // Array of Pet references
    subscribed: "bool",
    stripeCustomerId: "string?",
    username: "string",
    userPhoto: "string?",
    verified: "bool",
    email: "string",
    // Additional properties as needed
  },
};

export { User };
