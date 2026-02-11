require("dotenv").config();
const express = require("express");
const cors = require("cors");
const serverless = require("serverless-http");
require("dotenv").config({ path: "./backend/.env" });
const emailService = require("../services/emailService.js");
const authRoutes = require("../routes/auth.js");
const messageRoutes = require("../routes/messages.js");
console.log("IMAP HOST:", process.env.IMAP_HOST);
console.log("IMAP PORT:", process.env.IMAP_PORT);

const app = express();

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

/**
 * OPTIONAL
 * connect sekali saat cold start
 */
let isReady = false;

async function init() {
  if (!isReady) {
    try {
      await emailService.connect();
      console.log("✓ Email connected");
    } catch (err) {
      console.log("Email service failed:", err.message);
    }
    isReady = true;
  }
}

app.use(async (req, res, next) => {
  await init();
  next();
});

module.exports = serverless(app);
