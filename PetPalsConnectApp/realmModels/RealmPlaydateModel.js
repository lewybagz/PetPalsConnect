// RealmPlaydateModel.js
import Realm from "realm";

class Playdate extends Realm.Object {}
Playdate.schema = {
  name: "Playdate",
  primaryKey: "_id",
  properties: {
    _id: "objectId",
    date: "date",
    location: "objectId", // Reference to Location
    notes: "string?",
    participants: "objectId[]", // Array of User references
    petsInvolved: "objectId[]", // Array of Pet references
    startTime: "date",
    status: "string",
    reviews: "objectId[]", // Array of Review references
    creator: "objectId", // Reference to User
    modifiedDate: "date",
    createdDate: "date",
  },
};

export { Playdate };
