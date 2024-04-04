// RealmMediaModel.js
import Realm from "realm";

class Media extends Realm.Object {}
Media.schema = {
  name: "Media",
  primaryKey: "_id",
  properties: {
    _id: "objectId",
    url: "string",
    type: "string",
    thumbnail: "string?",
    createdBy: "objectId",
    createdAt: "date",
  },
};

export { Media };
