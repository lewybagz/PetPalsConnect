// RealmEventModel.js
import Realm from "realm";

class Event extends Realm.Object {}
Event.schema = {
  name: "Event",
  primaryKey: "_id",
  properties: {
    _id: "objectId",
    attendees: "objectId[]", // Array of User references
    date: "date",
    description: "string",
    organizer: "objectId", // References User
    title: "string",
    creator: "objectId", // References User
    modifiedDate: "date",
    createdDate: "date",
    slug: "string?",
  },
};

export { Event };
