import express from "express";
import verifyFirebaseToken from "../utils/firebaseAuth.js";
import { getProfile, updateProfile } from "../controllers/user.controller.js";

const router = express.Router();

// All routes are protected by Firebase token verification
router.get("/profile", verifyFirebaseToken, getProfile);
router.put("/profile", verifyFirebaseToken, updateProfile);

export default router;