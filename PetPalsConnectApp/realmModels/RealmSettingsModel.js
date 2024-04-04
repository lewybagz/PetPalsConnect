// RealmSettingsModel.js
import Realm from "realm";
import { Pet } from "./Pet";

class Settings extends Realm.Object {}
Settings.schema = {
  name: "Settings",
  primaryKey: "_id",
  properties: {
    _id: "string",
    locationSharingEnabled: "bool",
    playdateRange: "int",
    darkMode: "bool",
    notificationPreferences: {
      type: "string",
      default: JSON.stringify({
        petPalsMapUpdates: true,
        playdateReminders: true,
        appUpdates: true,
      }),
    },
  },
};

const databaseOptions = {
  path: "petPalsConnectApp.realm", // Path to the Realm file
  schema: [Pet.schema, Settings.schema], // Array of schema objects
  schemaVersion: 1, // Schema version
};

const getRealm = async () => {
  return await Realm.open(databaseOptions);
};

export { getRealm, Pet, Settings };
