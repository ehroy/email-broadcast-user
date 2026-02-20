const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../database");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Login
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username dan password harus diisi" });
  }

  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "Username atau password salah" });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "24h" },
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  });
});

// Get current user
// router.get("/me", authenticateToken, (req, res) => {
//   const user = db
//     .prepare("SELECT id, username, role FROM users WHERE id = ?")
//     .get(req.user.id);

//   if (!user) {
//     return res.status(404).json({ error: "User tidak ditemukan" });
//   }

//   // Get user permissions
//   let permissions = null;
//   if (user.role === "user") {
//     permissions = db
//       .prepare(
//         "SELECT allowed_keywords, allowed_emails FROM user_permissions WHERE user_id = ?",
//       )
//       .get(user.id);
//   }

//   res.json({
//     ...user,
//     allowedKeywords: permissions?.allowed_keywords || "",
//     allowedEmails: permissions?.allowed_emails || "",
//   });
// });

// Create user (admin only)
router.post("/users", authenticateToken, requireAdmin, (req, res) => {
  const { username, password, allowedKeywords, allowedEmails } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username dan password harus diisi" });
  }

  if (!allowedEmails || allowedEmails.trim() === "") {
    return res
      .status(400)
      .json({ error: "Allowed emails harus diisi untuk keamanan" });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  try {
    const result = db
      .prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)")
      .run(username, hashedPassword, "user");

    // Add permissions
    if (allowedKeywords || allowedEmails) {
      db.prepare(
        "INSERT INTO user_permissions (user_id, allowed_keywords, allowed_emails) VALUES (?, ?, ?)",
      ).run(result.lastInsertRowid, allowedKeywords || "", allowedEmails || "");
    }

    res.json({
      message: "User berhasil dibuat",
      userId: result.lastInsertRowid,
    });
  } catch (err) {
    if (err.message.includes("UNIQUE constraint failed")) {
      return res.status(400).json({ error: "Username sudah digunakan" });
    }
    res.status(500).json({ error: "Gagal membuat user" });
  }
});

// Get all users (admin only)
router.get("/users", authenticateToken, requireAdmin, (req, res) => {
  const users = db
    .prepare(
      `
    SELECT u.id, u.username, u.role, u.created_at, up.allowed_keywords, up.allowed_emails
    FROM users u
    LEFT JOIN user_permissions up ON u.id = up.user_id
    WHERE u.role = 'user'
  `,
    )
    .all();

  res.json(users);
});

// Update user permissions (admin only)
router.put(
  "/users/:id/permissions",
  authenticateToken,
  requireAdmin,
  (req, res) => {
    const { id } = req.params;
    const { allowedKeywords, allowedEmails } = req.body;

    if (!allowedEmails || allowedEmails.trim() === "") {
      return res
        .status(400)
        .json({ error: "Allowed emails harus diisi untuk keamanan" });
    }

    try {
      // Check if permission exists
      const existing = db
        .prepare("SELECT * FROM user_permissions WHERE user_id = ?")
        .get(id);

      if (existing) {
        db.prepare(
          "UPDATE user_permissions SET allowed_keywords = ?, allowed_emails = ? WHERE user_id = ?",
        ).run(allowedKeywords || "", allowedEmails || "", id);
      } else {
        db.prepare(
          "INSERT INTO user_permissions (user_id, allowed_keywords, allowed_emails) VALUES (?, ?, ?)",
        ).run(id, allowedKeywords || "", allowedEmails || "");
      }

      res.json({ message: "Permissions berhasil diupdate" });
    } catch (err) {
      res.status(500).json({ error: "Gagal mengupdate permissions" });
    }
  },
);

// Delete user (admin only)
router.delete("/users/:id", authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;

  try {
    db.prepare("DELETE FROM users WHERE id = ? AND role = ?").run(id, "user");
    res.json({ message: "User berhasil dihapus" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menghapus user" });
  }
});
// ─── Tambahan di route GET /me (auth.js) ────────────────────────────────────
// Ganti bagian GET /me yang ada dengan kode ini agar response juga menyertakan
// allowed_subjects untuk user biasa.

router.get("/me", authenticateToken, (req, res) => {
  const user = db
    .prepare("SELECT id, username, role FROM users WHERE id = ?")
    .get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: "User tidak ditemukan" });
  }

  // Get user permissions
  let permissions = null;
  if (user.role === "user") {
    permissions = db
      .prepare(
        "SELECT allowed_keywords, allowed_emails FROM user_permissions WHERE user_id = ?",
      )
      .get(user.id);
  }

  // ─── BARU: Ambil subjects yang diaktifkan untuk user ini ─────────────────
  let allowedSubjects = [];
  if (user.role === "user") {
    allowedSubjects = db
      .prepare(
        `SELECT s.id, s.name, s.pattern
         FROM subjects s
         INNER JOIN user_subjects us ON s.id = us.subject_id
         WHERE us.user_id = ? AND us.is_enabled = 1 AND s.is_active = 1`,
      )
      .all(user.id);
  } else {
    // Admin mendapat semua subjects
    allowedSubjects = db
      .prepare("SELECT id, name, pattern FROM subjects WHERE is_active = 1")
      .all();
  }

  res.json({
    ...user,
    allowedKeywords: permissions?.allowed_keywords || "",
    allowedEmails: permissions?.allowed_emails || "",
    allowedSubjects, // ← array of { id, name, pattern }
  });
});
module.exports = router;
