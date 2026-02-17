const express = require("express");
const emailService = require("../services/emailService");
const db = require("../database");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Get messages (fetch langsung dari IMAP dan filter by user permissions)
router.get("/", authenticateToken, async (req, res) => {
  const { search } = req.query;

  const user = req.user;

  try {
    let emails = [];

    // ===============================
    // ADMIN → bebas lihat semua
    // ===============================
    if (user.role === "admin") {
      emails = await emailService.fetchRecentEmails();
    }

    // ===============================
    // USER → harus lewat permission
    // ===============================
    else {
      const permissions = db
        .prepare(
          "SELECT allowed_keywords, allowed_emails FROM user_permissions WHERE user_id = ?",
        )
        .get(user.id);

      if (!permissions || !permissions.allowed_emails) {
        return res.json([]);
      }

      const allowedEmails = permissions.allowed_emails
        .split(",")
        .map((e) => e.trim().toLowerCase());

      const allowedKeywords = permissions.allowed_keywords
        ? permissions.allowed_keywords
            .split(",")
            .map((k) => k.trim().toLowerCase())
        : [];

      // ======================================
      // FETCH DARI IMAP BERDASARKAN WHITELIST
      // ======================================
      if (search) {
        emails = await emailService.searchFetchRecentEmails({
          search: search.toLowerCase(),
        });

        console.log(
          `User ${user.id} fetched ${emails.length} emails (before filter)`,
        );

        // ======================================
        // FILTER KEYWORD LAGI (double security)
        // ======================================
        if (allowedKeywords.length) {
          emails = emails.filter((email) => {
            const subjectLower = email.subject.toLowerCase();
            return allowedKeywords.some((ak) => subjectLower.includes(ak));
          });
        }
      } else {
        emails = await emailService.fetchRecentEmails({
          to: allowedEmails,
          subject: allowedKeywords, // optional, boleh kirim biar server lebih cepat,
        });

        console.log(
          `User ${user.id} fetched ${emails.length} emails (before filter)`,
        );

        // ======================================
        // FILTER KEYWORD LAGI (double security)
        // ======================================
        if (allowedKeywords.length) {
          emails = emails.filter((email) => {
            const subjectLower = email.subject.toLowerCase();
            return allowedKeywords.some((ak) => subjectLower.includes(ak));
          });
        }
      }
    }

    // ======================================
    // SEARCH TAMBAHAN DARI USER
    // ======================================
    if (search) {
      const searchLower = search.toLowerCase();
      emails = emails.filter(
        (email) =>
          email.keywords.toLowerCase().includes(searchLower) ||
          email.body.toLowerCase().includes(searchLower) ||
          email.from_email.toLowerCase().includes(searchLower) ||
          email.to_email.toLowerCase().includes(searchLower),
      );
    }

    // ======================================
    // SORT TERBARU
    // ======================================
    emails.sort(
      (a, b) => new Date(b.received_date) - new Date(a.received_date),
    );

    console.log(`Final result: ${emails.length} emails`);

    res.json(emails);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Gagal mengambil pesan dari email server" });
  }
});

// Get single message by ID (messageId)
router.get("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    // Fetch all emails and find by ID
    const emails = await emailService.fetchRecentEmails();
    const message = emails.find((e) => e.id === id || e.messageId === id);

    if (!message) {
      return res.status(404).json({ error: "Pesan tidak ditemukan" });
    }

    // Check permissions for regular users
    if (user.role === "user") {
      const permissions = db
        .prepare(
          "SELECT allowed_keywords, allowed_emails FROM user_permissions WHERE user_id = ?",
        )
        .get(user.id);

      if (permissions) {
        let hasAccess = false;

        // Check email permission
        if (permissions.allowed_emails) {
          const allowedEmails = permissions.allowed_emails
            .split(",")
            .map((e) => e.trim().toLowerCase());
          const messageFromEmail = message.from_email.toLowerCase();
          const emailMatch = allowedEmails.some((ae) =>
            messageFromEmail.includes(ae),
          );

          // Check keyword permission
          if (permissions.allowed_keywords) {
            const allowedKeywords = permissions.allowed_keywords
              .split(",")
              .map((k) => k.trim().toLowerCase());
            const messageKeywords = message.keywords
              .split(",")
              .map((k) => k.trim().toLowerCase());
            const keywordMatch = allowedKeywords.some((ak) =>
              messageKeywords.includes(ak),
            );

            // Must match both email AND keyword
            hasAccess = emailMatch && keywordMatch;
          } else {
            // Only email check if no keywords specified
            hasAccess = emailMatch;
          }
        }

        if (!hasAccess) {
          return res
            .status(403)
            .json({ error: "Anda tidak memiliki akses ke pesan ini" });
        }
      } else {
        return res
          .status(403)
          .json({ error: "Anda tidak memiliki akses ke pesan ini" });
      }
    }

    res.json(message);
  } catch (err) {
    console.error("Error fetching message:", err);
    res.status(500).json({ error: "Gagal mengambil pesan" });
  }
});

// Delete message (Note: Email tidak disimpan di database, jadi tidak bisa dihapus)
// Endpoint ini tetap ada untuk compatibility tapi hanya return success
router.delete("/:id", authenticateToken, (req, res) => {
  const { id } = req.params;

  // Karena email tidak disimpan di database,
  // kita tidak bisa hapus dari IMAP server (read-only)
  // Return success untuk compatibility
  res.json({
    message:
      "Pesan akan hilang otomatis setelah 15 menit atau saat sudah dibaca",
    note: "Email tidak disimpan di database, hanya di-fetch saat diperlukan",
  });
});

module.exports = router;
