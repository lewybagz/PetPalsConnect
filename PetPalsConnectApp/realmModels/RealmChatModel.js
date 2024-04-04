// RealmChatModel.js
import Realm from "realm";

class Chat extends Realm.Object {}
Chat.schema = {
  name: "Chat",
  primaryKey: "_id",
  properties: {
    _id: "objectId",
    chatId: "string",
    participants: "objectId[]", // Array of User references
    media: "objectId[]", // Array of Media references
    messages: "objectId[]", // Array of Message references
    isMuted: "bool",
    petId: "objectId", // References Pet
    lastMessage: "objectId", // References Message
    lastUpdated: "date",
    isArchived: "bool",
  },
};

export { Chat };
