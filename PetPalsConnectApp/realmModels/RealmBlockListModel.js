// RealmBlockListModel.js
import Realm from "realm";

class BlockList extends Realm.Object {}
BlockList.schema = {
  name: "BlockList",
  primaryKey: "_id",
  properties: {
    _id: "objectId",
    blockedUser: "objectId", // References User
    blockedUserList: "objectId[]", // Array of User references
    owner: "objectId", // References User
    creator: "objectId", // References User
    modifiedDate: "date",
    createdDate: "date",
  },
};

export { BlockList };
