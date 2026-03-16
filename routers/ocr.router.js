import express from "express";
import verifyFirebaseToken from "../utils/firebaseAuth.js";
import {
  readPrescription,
  analyzeMedicine,
  getHistory,
  getMyMedicines,
  checkInteractions,
} from "../controllers/ocr.controller.js";
import upload from "../configs/multer.config.js";

const router = express.Router();

// Existing
router.post("/prescription",  verifyFirebaseToken, upload.single("image"), readPrescription);
router.post("/medicine",      verifyFirebaseToken, upload.single("image"), analyzeMedicine);
router.get("/history/:type",  verifyFirebaseToken, getHistory);

// New
router.get("/my-medicines",       verifyFirebaseToken, getMyMedicines);
router.post("/check-interactions", verifyFirebaseToken, checkInteractions);

export default router;