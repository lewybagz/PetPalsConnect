// RealmMessageModel.js
import Realm from "realm";

class Message extends Realm.Object {}
Message.schema = {
  name: "Message",
  primaryKey: "_id",
  properties: {
    _id: "objectId",
    contentImage: "string?", // URL to the image (optional)
    contentText: "string",
    readStatus: "bool",
    receiver: "objectId", // Reference to User
    sender: "objectId", // Reference to User
    timestamp: "date",
    // Note: 'creator', 'modifiedDate', and 'createdDate' are often not needed in local databases
    // but can be included if they align with your application requirements
  },
};

export { Message };
