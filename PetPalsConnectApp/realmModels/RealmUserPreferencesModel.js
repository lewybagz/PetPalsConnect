// RealmUserPreferencesModel.js
import Realm from "realm";

class UserPreferences extends Realm.Object {}
UserPreferences.schema = {
  name: "UserPreferences",
  primaryKey: "_id",
  properties: {
    _id: "objectId",
    locationSharingEnabled: "bool",
    playdateRange: "int",
    notificationPreferences: {
      type: "string",
      default: JSON.stringify({
        petPalsMapUpdates: true,
        playdateReminders: true,
        appUpdates: true,
        pushNotificationsEnabled: true,
        emailNotificationsEnabled: false,
      }),
    },
    darkModeEnabled: "bool",
    profileVisibility: "bool",
    twoFactorAuthenticationEnabled: "bool",
    securityQuestions: "string[]?",
    user: "objectId",
  },
};

export { UserPreferences };
