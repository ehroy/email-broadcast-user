require("dotenv").config();
const express = require("express");
const cors = require("cors");
const emailService = require("./services/emailService");
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

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
