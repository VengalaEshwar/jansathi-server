import express from "express";
import verifyFirebaseToken from "../utils/firebaseAuth.js";
import { generateGuide } from "../controllers/guide.controller.js";

const router = express.Router();

// POST /guide/generate  { query: "how to apply for aadhaar" }
router.post("/generate", verifyFirebaseToken, generateGuide);

export default router;