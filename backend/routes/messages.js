const express = require("express");
const emailService = require("../services/emailService");
const db = require("../database");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// ════════════════════════════════════════════════════════════════
//  HELPER — ambil allowedEmails user dari DB
//  Return null kalau user tidak punya permission sama sekali
// ════════════════════════════════════════════════════════════════
function getAllowedEmails(userId) {
  const permissions = db
    .prepare("SELECT allowed_emails FROM user_permissions WHERE user_id = ?")
    .get(userId);

  if (!permissions?.allowed_emails?.trim()) return null;

  return permissions.allowed_emails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// ════════════════════════════════════════════════════════════════
//  GET /api/messages
//  Admin  → fetch semua email aktif, optional filter search
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

      // Filter teks tambahan dari search bar
      if (search) {
        const q = search.toLowerCase().trim();
        emails = emails.filter(
          (e) =>
            e.subject.toLowerCase().includes(q) ||
            e.from_email.toLowerCase().includes(q) ||
            e.to_email.toLowerCase().includes(q) ||
            e.keywords.toLowerCase().includes(q),
        );
      }
    }

    // ── USER ──────────────────────────────────────────────────────
    else {
      const allowedEmails = getAllowedEmails(userId);

      // User tanpa allowed_emails tidak bisa lihat apapun
      if (!allowedEmails) {
        return res.json([]);
      }

      if (search) {
        // Search: fetch lalu filter by search term
        // Validasi bahwa search masuk allowedEmails dilakukan di emailService
        emails = await emailService.searchFetchRecentEmails({
          search: search.toLowerCase().trim(),
          minutes: 10,
          userId,
          userRole,
          allowedEmails,
        });
      } else {
        // Fetch semua email TO yang masuk allowedEmails + subject sesuai user_subjects
        emails = await emailService.userFetchRecentEmails({
          to: allowedEmails,
          minutes: 10,
          userId,
          userRole,
          allowedEmails,
        });
      }

      console.log(`User ${userId} fetched ${emails.length} emails`);
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
//  Ambil satu pesan — cari dari cache fetchRecentEmails
//  Menggunakan minutes: 10 agar konsisten dengan list endpoint
// ════════════════════════════════════════════════════════════════
router.get("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { id: userId, role: userRole } = req.user;

  try {
    let allowedEmails = [];

    if (userRole !== "admin") {
      const emails_allowed = getAllowedEmails(userId);

      if (!emails_allowed) {
        return res.status(403).json({ error: "Anda tidak memiliki akses" });
      }

      allowedEmails = emails_allowed;
    }

    // Fetch dengan window sama seperti list → kemungkinan besar hit cache
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
//  POST /api/messages/cache/clear  (admin only)
//  Force refresh cache tanpa restart server
// ════════════════════════════════════════════════════════════════
router.post("/cache/clear", authenticateToken, (req, res) => {
  const { role: userRole, id: userId } = req.user;

  if (userRole !== "admin") {
    return res.status(403).json({ error: "Hanya admin yang bisa clear cache" });
  }

  const { target_user_id } = req.body;

  if (target_user_id) {
    emailService.clearCache(target_user_id);
    return res.json({
      message: `Cache cleared untuk userId=${target_user_id}`,
    });
  }

  emailService.clearCache(); // clear semua
  res.json({ message: "Semua cache berhasil di-clear" });
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
