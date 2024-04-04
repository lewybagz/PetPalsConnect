// RealmFavoriteModel.js
import Realm from "realm";

class Favorite extends Realm.Object {}
Favorite.schema = {
  name: "Favorite",
  primaryKey: "_id",
  properties: {
    _id: "objectId",
    content: "objectId", // References Content
    user: "objectId", // References User
    pet: "objectId", // References Pet
    creator: "objectId", // References User
    modifiedDate: "date",
    createdDate: "date",
    slug: "string?",
  },
};

export { Favorite };
