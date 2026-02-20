const express = require("express");
const emailService = require("../services/emailService");
const db = require("../database");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// ════════════════════════════════════════════════════════════════
//  GET /api/messages
//  Admin  → fetch semua, filter by subjects aktif di DB
//  User   → HARUS lolos dua filter:
//            1. to_email ada di allowed_emails user
//            2. subject cocok dengan subjects yang di-enable user
// ════════════════════════════════════════════════════════════════
router.get("/", authenticateToken, async (req, res) => {
  const { search } = req.query;
  const { id: userId, role: userRole } = req.user;

  try {
    let emails = [];

    // ── ADMIN ─────────────────────────────────────────────────────
    if (userRole === "admin") {
      emails = await emailService.fetchRecentEmails({
        minutes: 10,
        userId,
        userRole,
        // allowedEmails kosong → admin tidak dibatasi TO
      });
    }

    // ── USER ──────────────────────────────────────────────────────
    else {
      const permissions = db
        .prepare(
          "SELECT allowed_emails FROM user_permissions WHERE user_id = ?",
        )
        .get(userId);

      // User tanpa allowed_emails tidak bisa lihat apapun
      if (!permissions?.allowed_emails?.trim()) {
        return res.json([]);
      }

      const allowedEmails = permissions.allowed_emails
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      if (search) {
        // Cari berdasarkan TO = search
        // emailService akan validasi: search harus ada di allowedEmails user
        // lalu filter subject sesuai user_subjects
        emails = await emailService.searchFetchRecentEmails({
          search: search.toLowerCase(),
          minutes: 10,
          userId,
          userRole,
          allowedEmails, // ← double-filter: search harus masuk whitelist TO
        });
      } else {
        // Fetch semua email yang TO-nya masuk allowedEmails
        // + subject sesuai user_subjects (AND, bukan OR)
        emails = await emailService.userFetchRecentEmails({
          to: allowedEmails, // filter IMAP level
          minutes: 10,
          userId,
          userRole,
          allowedEmails, // ← double-filter saat parsing hasil IMAP
        });
      }

      console.log(`User ${userId} fetched ${emails.length} emails`);
    }

    // ── FILTER TEKS TAMBAHAN untuk admin (search bar frontend) ────
    if (search && userRole === "admin") {
      const q = search.toLowerCase();
      emails = emails.filter(
        (e) =>
          e.subject.toLowerCase().includes(q) ||
          e.from_email.toLowerCase().includes(q) ||
          e.to_email.toLowerCase().includes(q) ||
          e.keywords.toLowerCase().includes(q),
      );
    }

    // ── SORT TERBARU DULU ─────────────────────────────────────────
    emails.sort(
      (a, b) => new Date(b.received_date) - new Date(a.received_date),
    );

    console.log(`Final result: ${emails.length} emails for userId=${userId}`);
    res.json(emails);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Gagal mengambil pesan dari email server" });
  }
});

// ════════════════════════════════════════════════════════════════
//  GET /api/messages/:id
//  Ambil satu pesan — emailService sudah filter dua lapis,
//  jika pesan ada dalam hasil berarti sudah lolos akses.
// ════════════════════════════════════════════════════════════════
router.get("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { id: userId, role: userRole } = req.user;

  try {
    let allowedEmails = [];

    if (userRole !== "admin") {
      const permissions = db
        .prepare(
          "SELECT allowed_emails FROM user_permissions WHERE user_id = ?",
        )
        .get(userId);

      if (!permissions?.allowed_emails?.trim()) {
        return res.status(403).json({ error: "Anda tidak memiliki akses" });
      }

      allowedEmails = permissions.allowed_emails
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    }

    const emails = await emailService.fetchRecentEmails({
      minutes: 10,
      userId,
      userRole,
      allowedEmails,
    });

    const message = emails.find((e) => e.id === id || e.messageId === id);

    if (!message) {
      return res.status(404).json({ error: "Pesan tidak ditemukan" });
    }

    res.json(message);
  } catch (err) {
    console.error("Error fetching message:", err);
    res.status(500).json({ error: "Gagal mengambil pesan" });
  }
});

// ════════════════════════════════════════════════════════════════
//  DELETE /api/messages/:id  (compatibility stub)
// ════════════════════════════════════════════════════════════════
router.delete("/:id", authenticateToken, (req, res) => {
  res.json({
    message: "Pesan akan hilang otomatis setelah waktu habis",
    note: "Email tidak disimpan di database, hanya di-fetch saat diperlukan",
  });
});

module.exports = router;
