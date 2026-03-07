import app from "./app.js";
import env from "./configs/env.config.js";
import connectDB from "./configs/db.config.js";
// import  importSchemes  from "./utils/loader.js";
// Connect Database
connectDB();
// importSchemes(); // dont run this line
// Start Server
const server = app.listen(env.PORT, () => {
  console.log(
    `🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`
  );
});

/* =====================
   Error Handling
===================== */

// Uncaught Exception
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
  process.exit(1);
});

// Unhandled Promise Rejection
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err.message);
  server.close(() => process.exit(1));
});