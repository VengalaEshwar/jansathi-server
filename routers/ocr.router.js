import express from "express";
import verifyFirebaseToken from "../utils/firebaseAuth.js";
import { readPrescription, analyzeMedicine } from "../controllers/ocr.controller.js";
import upload from "../configs/multer.config.js";

const router = express.Router();

router.post("/prescription", verifyFirebaseToken, upload.single("image"), readPrescription);
router.post("/medicine", verifyFirebaseToken, upload.single("image"), analyzeMedicine);

export default router;