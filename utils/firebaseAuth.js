import admin from "../configs/firebase.config.js";
import User from "../models/user.model.js";

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized - No token provided",
    });
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    // Verify token with Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Auto-create user in MongoDB if first login
    let user = await User.findOne({ uid: decodedToken.uid });

    if (!user) {
      user = await User.create({
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || "",
        isVerified: decodedToken.email_verified || false,
      });
    }

    req.user = decodedToken; // Firebase token data
    req.dbUser = user;       // MongoDB user data
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized - Invalid token",
    });
  }
};

export default verifyFirebaseToken;