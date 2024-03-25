// RealmPetModel.js
import Realm from "realm";

class Pet extends Realm.Object {}
Pet.schema = {
  name: "Pet",
  primaryKey: "_id",
  properties: {
    _id: "string",
    age: "int",
    breed: "string",
    name: "string",
    owner: "string", // Assuming owner is represented by a unique identifier
    photos: "string[]",
    location: "string?", // Optional field, represented by a unique identifier
    playdates: "string[]?", // Array of unique identifiers for playdates
    specialNeeds: "string?",
    temperament: "string?",
    weight: "double",
  },
};

const databaseOptions = {
  path: "petPalsConnectApp.realm",
  schema: [Pet],
  schemaVersion: 0, // Increment this number when the schema changes
};

// Function to get the Realm database
const getRealm = async () => {
  return await Realm.open(databaseOptions);
};

export { getRealm, Pet };
