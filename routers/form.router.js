import express from "express";
import verifyFirebaseToken from "../utils/firebaseAuth.js";
import { extractFormFields, fillForm, downloadForm } from "../controllers/form.controller.js";
import upload from "../configs/multer.config.js";

const router = express.Router();

router.post("/extract", verifyFirebaseToken, upload.single("image"), extractFormFields);
router.post("/fill", verifyFirebaseToken, fillForm);
router.get("/download/:pdfId", verifyFirebaseToken, downloadForm);

export default router;