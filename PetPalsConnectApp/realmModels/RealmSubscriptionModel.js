// RealmSubscriptionModel.js
import Realm from "realm";

class Subscription extends Realm.Object {}
Subscription.schema = {
  name: "Subscription",
  primaryKey: "_id",
  properties: {
    _id: "objectId",
    endDate: "date",
    planType: "string",
    startDate: "date",
    status: "string",
    amount: "double",
    user: "objectId", // Reference to User
    // Additional properties as needed
  },
};

export { Subscription };
