import express from "express";
import verifyFirebaseToken from "../utils/firebaseAuth.js";
import {
  getProfile,
  updateProfile,
  updatePreferences,
  updatePersonalInfo,
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/profile", verifyFirebaseToken, getProfile);
router.put("/profile", verifyFirebaseToken, updateProfile);
router.patch("/preferences", verifyFirebaseToken, updatePreferences);
router.patch("/personal-info", verifyFirebaseToken, updatePersonalInfo);

export default router;