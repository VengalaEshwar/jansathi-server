import express from "express";
import cors from "cors";
import morgan from "morgan";

import chatRouter from "./routers/chat.router.js";
import ocrRouter from "./routers/ocr.router.js";
import authRouter from "./routers/auth.router.js";
import formRouter from "./routers/form.router.js";
import schemeRouter from "./routers/scheme.router.js";
const app = express();

/* =====================
   Global Middlewares
===================== */

// Enable CORS
const allowedOrigins = [
  "https://jansathi.netlify.app",
  "https://jansathi.eshwarvengala.in",
  "http://localhost:8081",
  "http://localhost:19006",
  "http://localhost:3000",
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow mobile apps (no origin) and allowed web origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

// Parse JSON requests
app.use(express.json());

// Parse URL encoded data
app.use(express.urlencoded({ extended: true }));

// Logger
app.use(morgan("dev"));

// increase payload limit for OCR image uploads
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
/* =====================
   Health Check Route
===================== */

app.get("/", (req, res) => {
  res.send("🚀 Jansathi API is running...");
});

/* =====================
   Routes
===================== */
// Example:
// import userRoutes from "./routes/user.routes.js";
// app.use("/api/users", userRoutes);

app.use("/api/auth", authRouter);
app.use("/api/chat", chatRouter);
app.use("/api/ocr", ocrRouter);
app.use("/api/form", formRouter);
app.use("/api/schemes", schemeRouter);
/* =====================
   api for models of gemini ai
===================== */
app.get("/models", async (req, res) => {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const models = await ai.models.list();
  const list = [];
  for await (const m of models) list.push(m.name);
  res.json(list);
});
/* =====================
   Global Error Handler
===================== */

app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

export default app;