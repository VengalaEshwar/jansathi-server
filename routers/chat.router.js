import express from "express";
import verifyFirebaseToken from "../utils/firebaseAuth.js";
import { chat } from "../controllers/chat.controller.js";

const router = express.Router();

// Protected — user must be logged in
router.post("/", verifyFirebaseToken, chat);

export default router;