import app from "./app.js";
import env from "./configs/env.config.js";
import connectDB from "./configs/db.config.js";

connectDB();

const server = app.listen(env.PORT, async () => {
  console.log(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);

  // ── Dev only: node-cron every 15 minutes ──────────────────────
  if (env.NODE_ENV !== "production") {
    const { default: cron } = await import("node-cron");

    // Runs at :00, :15, :30, :45 of every hour
    cron.schedule("0,15,30,45 * * * *", async () => {
      try {
        const res = await fetch(`http://localhost:${env.PORT}/api/cron/check-reminders`, {
          headers: { "x-cron-secret": env.CRON_SECRET || "dev" },
        });
        const data = await res.json();
        console.log(`⏰ Cron result:`, data);
      } catch (e) {
        console.error("Local cron error:", e.message);
      }
    });

    // Cleanup runs once daily at midnight
    cron.schedule("0 0 * * *", async () => {
      try {
        const res = await fetch(`http://localhost:${env.PORT}/api/cron/cleanup-reminders`, {
          headers: { "x-cron-secret": env.CRON_SECRET || "dev" },
        });
        const data = await res.json();
        console.log("🧹 Cleanup result:", data);
      } catch (e) {
        console.error("Cleanup cron error:", e.message);
      }
    });

    console.log("✅ Local cron scheduler started (every 15min: 00, 15, 30, 45)");
  }
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err.message);
  server.close(() => process.exit(1));
});