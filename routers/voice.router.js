// routes/voice.routes.js
import express from "express";
import { handleVoiceCommand } from "../controllers/voice.controller.js";
import  verifyFirebaseToken  from "../utils/firebaseAuth.js"

const router = express.Router();

// POST /api/voice/command
// Auth required — we need currentRoute and conversationHistory tied to a user
router.post("/command", verifyFirebaseToken, handleVoiceCommand);

export default router;