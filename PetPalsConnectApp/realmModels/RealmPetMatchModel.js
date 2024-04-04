// RealmPetMatchModel.js
import Realm from "realm";

class PetMatch extends Realm.Object {}
PetMatch.schema = {
  name: "PetMatch",
  primaryKey: "_id",
  properties: {
    _id: "objectId",
    matchScore: "int",
    pet1: "objectId", // Reference to Pet
    pet2: "objectId", // Reference to Pet
    relevantToUser: "objectId", // Reference to User
    timestamp: "date",
    creator: "objectId", // Reference to User
    modifiedDate: "date",
    createdDate: "date",
  },
};

export { PetMatch };
