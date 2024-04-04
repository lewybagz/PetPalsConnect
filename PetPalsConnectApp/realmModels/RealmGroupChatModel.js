// RealmGroupChatModel.js
import Realm from "realm";

class GroupChat extends Realm.Object {}
GroupChat.schema = {
  name: "GroupChat",
  primaryKey: "_id",
  properties: {
    _id: "objectId",
    groupName: "string",
    messages: "objectId[]", // Array of ObjectIds referring to Message
    media: "objectId[]", // Array of ObjectIds referring to Media
    participants: "objectId[]", // Array of ObjectIds referring to Pet
    isMuted: { type: "bool", default: false },
    isArchived: { type: "bool", default: false },
    creator: "objectId", // References User
    modifiedDate: "date",
    lastUpdated: "date",
    createdDate: "date",
  },
};

export { GroupChat };
