// RealmReviewModel.js
import Realm from "realm";

class Review extends Realm.Object {}
Review.schema = {
  name: "Review",
  primaryKey: "_id",
  properties: {
    _id: "objectId",
    comment: "string",
    date: "date",
    rating: "int",
    relatedArticle: "objectId?", // Reference to Article
    relatedPlaydate: "objectId?", // Reference to Playdate
    relatedService: "objectId?", // Reference to Service
    relatedLocation: "objectId?", // Reference to Location
    reviewer: "objectId", // Reference to User
    visibility: "bool",
    // Additional properties as needed
  },
};

export { Review };
