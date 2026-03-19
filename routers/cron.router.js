import express from "express";
import { checkReminders, cleanupReminders } from "../controllers/cron.controller.js";

const router = express.Router();

// Vercel calls these automatically via vercel.json cron config
// No auth needed — Vercel adds x-vercel-cron-signature header internally
router.get("/check-reminders", checkReminders);
router.get("/cleanup-reminders", cleanupReminders);

export default router;