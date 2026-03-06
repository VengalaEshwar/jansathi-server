import express from "express";
import cors from "cors";
import morgan from "morgan";

import authRouter from "./routers/auth.router.js";

const app = express();

/* =====================
   Global Middlewares
===================== */

// Enable CORS
app.use(cors());

// Parse JSON requests
app.use(express.json());

// Parse URL encoded data
app.use(express.urlencoded({ extended: true }));

// Logger
app.use(morgan("dev"));

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