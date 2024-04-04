// RealmActivityLogModel.js
import Realm from "realm";

class ActivityLog extends Realm.Object {}
ActivityLog.schema = {
  name: "ActivityLog",
  primaryKey: "_id",
  properties: {
    _id: "objectId",
    actionDetails: "string",
    actionType: "string",
    timestamp: "date",
    user: "string", // Assuming the user ID is a string
    creator: "string", // Assuming the creator ID is a string
    modifiedDate: "date",
    createdDate: "date",
    slug: "string?",
  },
};

export { ActivityLog };
