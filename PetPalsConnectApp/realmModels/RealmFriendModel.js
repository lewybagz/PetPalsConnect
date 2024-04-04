// RealmFriendModel.js
import Realm from "realm";

class Friend extends Realm.Object {}
Friend.schema = {
  name: "Friend",
  primaryKey: "_id",
  properties: {
    _id: "objectId",
    status: "bool",
    timestamp: "date",
    user1: "objectId", // References User
    user2: "objectId", // References User
    creator: "objectId", // References User
    modifiedDate: "date",
    createdDate: "date",
    slug: "string?",
  },
};

export { Friend };
