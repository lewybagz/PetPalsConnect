// RealmPetModel.js
import Realm from "realm";
import { Settings } from "./Settings";

class Pet extends Realm.Object {}
Pet.schema = {
  name: "Pet",
  primaryKey: "_id",
  properties: {
    _id: "string",
    age: "int",
    breed: "string",
    name: "string",
    owner: "string",
    photos: "string[]",
    location: "string?",
    playdates: "string[]?",
    specialNeeds: "string?",
    temperament: "string?",
    weight: "double",
  },
};

const databaseOptions = {
  path: "petPalsConnectApp.realm",
  schema: [Pet.schema, Settings.schema],
  schemaVersion: 1,
};

const getRealm = async () => {
  return await Realm.open(databaseOptions);
};

export { getRealm, Pet, Settings };
