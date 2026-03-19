import express from "express";
import verifyFirebaseToken from "../utils/firebaseAuth.js";
import {
  sendPhoneOtp, verifyPhoneOtp,
  sendEmailOtp, verifyEmailOtp,
  saveFcmToken,
  createReminder, getReminders,
  updateReminder, deleteReminder,checkSmsAvailability,
} from "../controllers/reminder.controller.js";

const router = express.Router();

router.get("/sms-availability", verifyFirebaseToken, checkSmsAvailability);
router.post("/send-phone-otp", verifyFirebaseToken, sendPhoneOtp);
router.post("/verify-phone-otp", verifyFirebaseToken, verifyPhoneOtp);
router.post("/send-email-otp", verifyFirebaseToken, sendEmailOtp);
router.post("/verify-email-otp", verifyFirebaseToken, verifyEmailOtp);
router.post("/fcm-token", verifyFirebaseToken, saveFcmToken);
router.get("/", verifyFirebaseToken, getReminders);
router.post("/", verifyFirebaseToken, createReminder);
router.patch("/:id", verifyFirebaseToken, updateReminder);
router.delete("/:id", verifyFirebaseToken, deleteReminder);

export default router;