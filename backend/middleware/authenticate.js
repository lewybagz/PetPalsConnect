const admin = require("firebase-admin");

const authenticate = async (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).json({ message: "Authorization header is missing" });
  }
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Attach the entire decodedToken which includes user details
    req.user = decodedToken;

    req.userId = decodedToken.uid; // Assuming uid is the user ID in Firebase tokens

    next();
  } catch (error) {
    console.error(error);
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

module.exports = authenticate;
