// RealmArticleModel.js
import Realm from "realm";

class Article extends Realm.Object {}
Article.schema = {
  name: "Article",
  primaryKey: "_id",
  properties: {
    _id: "objectId",
    content: "string",
    publishedDate: "date",
    tags: "string[]",
    title: "string",
  },
};

export { Article };
