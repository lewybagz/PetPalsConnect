// RealmNotificationModel.js
import Realm from "realm";

class Notification extends Realm.Object {}
Notification.schema = {
  name: "Notification",
  primaryKey: "_id",
  properties: {
    _id: "objectId",
    content: "string",
    readStatus: { type: "bool", default: false },
    recipient: "objectId", // Reference to User
    timestamp: "date",
    type: "string",
    creator: "objectId", // Reference to User
    modifiedDate: "date",
    createdDate: "date",
  },
};

export { Notification };
