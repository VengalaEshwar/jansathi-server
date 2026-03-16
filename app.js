import express from "express";
import cors from "cors";
import morgan from "morgan";
import admin from "./configs/firebase.config.js";

import chatRouter from "./routers/chat.router.js";
import ocrRouter from "./routers/ocr.router.js";
import authRouter from "./routers/auth.router.js";
import formRouter from "./routers/form.router.js";
import schemeRouter from "./routers/scheme.router.js";
import reminderRouter from "./routers/reminder.router.js";
import cronRouter from "./routers/cron.router.js";
import volunteerRouter from "./routers/volunteer.router.js";
import guideRoutes from "./routers/guide.router.js";

const app = express();

// ── CORS ──────────────────────────────────────────────────────────
const allowedOrigins = [
  "https://jansathi.netlify.app",
  "https://jansathi.eshwarvengala.in",
  "http://localhost:8081",
  "http://localhost:19006",
  "http://localhost:3000",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

// ── Middlewares ───────────────────────────────────────────────────
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.use(morgan("dev"));

// ── Health Check ──────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("🚀 Jansathi API is running...");
});

// ── Routes ────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/chat", chatRouter);
app.use("/api/ocr", ocrRouter);
app.use("/api/form", formRouter);
app.use("/api/schemes", schemeRouter);
app.use("/api/reminders", reminderRouter);
app.use("/api/cron", cronRouter);
app.use("/api/volunteer", volunteerRouter);
app.use("/api/guide", guideRoutes);
// ── Gemini Models ─────────────────────────────────────────────────
app.get("/models", async (req, res) => {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const models = await ai.models.list();
  const list = [];
  for await (const m of models) list.push(m.name);
  res.json(list);
});

// ── Firebase Test ─────────────────────────────────────────────────
app.get("/test-firebase", async (req, res) => {
  try {
    const a = admin.app();
    res.json({ success: true, projectId: a.options.credential.projectId ?? "initialized" });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ── Global Error Handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

export default app;