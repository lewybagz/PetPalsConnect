// RealmPotentialPlaydateLocationModel.js
import Realm from "realm";

class PotentialPlaydateLocation extends Realm.Object {}
PotentialPlaydateLocation.schema = {
  name: "PotentialPlaydateLocation",
  primaryKey: "_id",
  properties: {
    _id: "objectId",
    name: "string",
    address: "string",
    placeId: "string",
    geoLocation: {
      type: "GeoLocation", // Define a new class or object type for GeoLocation if needed
      objectType: true,
    },
    photo: "string?",
    description: "string?",
    creator: "objectId?", // Reference to User
    // Additional fields like ratings, reviews, etc., can be added
  },
};

export { PotentialPlaydateLocation };
