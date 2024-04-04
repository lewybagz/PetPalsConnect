// RealmReportModel.js
import Realm from "realm";

class Report extends Realm.Object {}
Report.schema = {
  name: "Report",
  primaryKey: "_id",
  properties: {
    _id: "objectId", // Automatically generated unique ID
    content: "string",
    reportedContent: "string",
    reportedUser: "string", // Could be a reference to User's unique identifier
    reporter: "string", // Reference to the reporter's User identifier
    status: "string",
    timestamp: "date?",
    creator: "string", // Reference to the creator's User identifier
    modifiedDate: "date?",
    createdDate: "date?",
    slug: "string?",
  },
};

export default Report;
