// RealmFriendRequestModel.js
import Realm from "realm";

class FriendRequest extends Realm.Object {}
FriendRequest.schema = {
  name: "FriendRequest",
  primaryKey: "_id",
  properties: {
    _id: "objectId",
    sender: "objectId", // References User
    receiver: "objectId", // References User
    status: { type: "string", default: "pending" },
    createdDate: "date",
    modifiedDate: "date",
  },
};

export { FriendRequest };
