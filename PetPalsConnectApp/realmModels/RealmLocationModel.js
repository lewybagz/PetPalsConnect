// RealmLocationModel.js
import Realm from "realm";

class Location extends Realm.Object {}
Location.schema = {
  name: "Location",
  primaryKey: "_id",
  properties: {
    _id: "objectId",
    address: "string",
    description: "string?",
    photo: "string?", // URL to the image
    rating: "float?", // Assuming rating can be a decimal
    reviews: "string[]", // Array of strings (or can be ObjectIds if referring to 'Review' model)
    creator: "objectId", // Reference to User
    modifiedDate: "date",
    createdDate: "date",
    slug: "string?",
    geoLocation: "GeoLocation", // Define 'GeoLocation' schema below
  },
};

class GeoLocation extends Realm.Object {}
GeoLocation.schema = {
  name: "GeoLocation",
  properties: {
    type: { type: "string", default: "Point" },
    coordinates: "double[]", // Array of doubles for longitude and latitude
  },
};

export { Location, GeoLocation };
