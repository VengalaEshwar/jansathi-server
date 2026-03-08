import admin from "../configs/firebase.config.js";
import User from "../models/user.model.js";

const verifyFirebaseToken = async (req, res, next) => {
  let token = null;

  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split("Bearer ")[1];
  }

  // Fall back to query param (for GET download links)
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized - No token provided" });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);

    let user = await User.findOne({ uid: decodedToken.uid });
    if (!user) {
      user = await User.create({
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || "",
        isVerified: decodedToken.email_verified || false,
      });
    }

    req.user = decodedToken;
    req.dbUser = user;
    next();
  } catch (error) {
    console.error("Token error:", error.code, error.message);
    return res.status(401).json({ 
      success: false, 
      message: "Invalid token",
      errorCode: error.code,  // ← add this
      tokenPreview: token?.substring(0, 30) // ← add this
    });
    
  }
};

export default verifyFirebaseToken;