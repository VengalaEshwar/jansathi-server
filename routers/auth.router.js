import express from "express";
import verifyFirebaseToken from "../utils/firebaseAuth.js";
import multer from "multer";
import {
  getProfile,
  updateProfile,
  updatePreferences,
  updatePersonalInfo,
  uploadAvatar,
  deleteAvatar
} from "../controllers/user.controller.js";


const router = express.Router();

// multer memory storage for avatar upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images allowed"));
  },
});
// Temporary debug - replace upload.single("avatar") with this

router.get("/profile", verifyFirebaseToken, getProfile);
router.put("/profile", verifyFirebaseToken, updateProfile);
router.patch("/preferences", verifyFirebaseToken, updatePreferences);
router.patch("/personal-info", verifyFirebaseToken, updatePersonalInfo);
router.delete("/delete-avatar", verifyFirebaseToken, deleteAvatar);
router.post("/upload-avatar", verifyFirebaseToken, (req, res, next) => {
  upload.single("avatar")(req, res, (err) => {
    if (err) {
      console.log("Multer error:", err.message, err.field);
      return res.status(400).json({ success: false, message: err.message, field: err.field });
    }
    next();
  });
}, uploadAvatar);
export default router;