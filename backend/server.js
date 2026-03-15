require("dotenv").config();
const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");
const subject = require("./routes/subject");
const emailService = require("./services/emailService");
emailService.startBackgroundRefresh(30); // refresh tiap 30 detik

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  const start = Date.now();
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  console.log(`➡️  ${req.method} ${req.originalUrl} | IP: ${ip}`);

  res.on("finish", () => {
    const duration = Date.now() - start;

    console.log(
      `⬅️  ${req.method} ${req.originalUrl} | ${res.statusCode} | ${duration}ms`,
    );
  });

  next();
});
// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/subjects", subject);
// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    emailConnected: emailService.isConnected,
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`
╔════════════════════════════════════════════╗
║  Email OTP Broadcast Server                ║
║  Running on http://localhost:${PORT}       ║
╚════════════════════════════════════════════╝
  `);

  // Connect to email service
  try {
    await emailService.connect();
    console.log("✓ Email service connected and ready");
    console.log("✓ Emails will be fetched on-demand (no database storage)");
  } catch (err) {
    console.error("Failed to connect to email service:", err);
    console.log("⚠️  Server running but email service unavailable");
  }
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down gracefully...");
  emailService.disconnect();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nShutting down gracefully...");
  emailService.disconnect();
  process.exit(0);
});
