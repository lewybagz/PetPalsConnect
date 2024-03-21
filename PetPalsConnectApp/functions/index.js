const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// prettier-ignore
exports.schedulePlaydateReviewNotification = functions.firestore

    .document("playdates/{playdateId}")
    .onCreate(async (snap, context) => {
      const playdateData = snap.data();
      const participantId = playdateData.participantId;
      // Retrieve FCM token for the participant
      const userRef = admin.firestore().collection("users").doc(participantId);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        console.log("User not found");
        return null;
      }
      const user = userSnap.data();
      const fcmToken = user.fcmToken;

      if (!fcmToken) {
        console.log("No FCM Token for user");
        return null;
      }

      // Construct the notification message
      const message = {
        token: fcmToken,
        notification: {
          title: "Review Your Playdate",
          body: "Don't forget to leave a review for your recent playdate.",
        },
        data: {
          playdateId: context.params.playdateId,
          // Add additional data if needed
        },
      };

      try {
      // Send a message using FCM
        await admin.messaging().send(message);
        console.log("Notification sent successfully");
      } catch (error) {
        console.error("Error sending notification:", error);
      }

      return null;
    });
