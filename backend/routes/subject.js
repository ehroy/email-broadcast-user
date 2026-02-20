const express = require("express");
const db = require("../database");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// ════════════════════════════════════════════════════════════════
//  ADMIN ROUTES — Kelola daftar subjects
// ════════════════════════════════════════════════════════════════

/**
 * GET /api/subjects
 * Ambil semua subject (admin: semua, user: hanya yang diizinkan)
 */
router.get("/", authenticateToken, (req, res) => {
  try {
    if (req.user.role === "admin") {
      // Admin melihat semua subject beserta jumlah user yang menggunakannya
      const subjects = db
        .prepare(
          `
          SELECT
            s.*,
            COUNT(us.user_id) AS user_count
          FROM subjects s
          LEFT JOIN user_subjects us ON s.id = us.subject_id AND us.is_enabled = 1
          GROUP BY s.id
          ORDER BY s.created_at DESC
        `,
        )
        .all();

      return res.json(subjects);
    }

    // User biasa: hanya subject yang diaktifkan untuk dia
    const subjects = db
      .prepare(
        `
        SELECT s.*, us.is_enabled
        FROM subjects s
        INNER JOIN user_subjects us ON s.id = us.subject_id
        WHERE us.user_id = ? AND s.is_active = 1
        ORDER BY s.name ASC
      `,
      )
      .all(req.user.id);

    res.json(subjects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil data subjects" });
  }
});

/**
 * POST /api/subjects
 * Tambah subject baru (admin only)
 */
router.post("/", authenticateToken, requireAdmin, (req, res) => {
  const { name, pattern, description } = req.body;

  if (!name || !pattern) {
    return res.status(400).json({ error: "Name dan pattern harus diisi" });
  }

  try {
    const result = db
      .prepare(
        "INSERT INTO subjects (name, pattern, description) VALUES (?, ?, ?)",
      )
      .run(name.trim(), pattern.trim(), description?.trim() || "");

    res.json({
      message: "Subject berhasil ditambahkan",
      subjectId: result.lastInsertRowid,
    });
  } catch (err) {
    if (err.message.includes("UNIQUE constraint failed")) {
      return res.status(400).json({ error: "Pattern subject sudah ada" });
    }
    console.error(err);
    res.status(500).json({ error: "Gagal menambahkan subject" });
  }
});

/**
 * PUT /api/subjects/:id
 * Edit subject (admin only)
 */
router.put("/:id", authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, pattern, description, is_active } = req.body;

  if (!name || !pattern) {
    return res.status(400).json({ error: "Name dan pattern harus diisi" });
  }

  try {
    const changes = db
      .prepare(
        `UPDATE subjects
         SET name = ?, pattern = ?, description = ?, is_active = ?
         WHERE id = ?`,
      )
      .run(
        name.trim(),
        pattern.trim(),
        description?.trim() || "",
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
        id,
      );

    if (changes.changes === 0) {
      return res.status(404).json({ error: "Subject tidak ditemukan" });
    }

    res.json({ message: "Subject berhasil diupdate" });
  } catch (err) {
    if (err.message.includes("UNIQUE constraint failed")) {
      return res.status(400).json({ error: "Pattern subject sudah ada" });
    }
    console.error(err);
    res.status(500).json({ error: "Gagal mengupdate subject" });
  }
});

/**
 * DELETE /api/subjects/:id
 * Hapus subject (admin only)
 */
router.delete("/:id", authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;

  try {
    const changes = db.prepare("DELETE FROM subjects WHERE id = ?").run(id);

    if (changes.changes === 0) {
      return res.status(404).json({ error: "Subject tidak ditemukan" });
    }

    res.json({ message: "Subject berhasil dihapus" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menghapus subject" });
  }
});

// ════════════════════════════════════════════════════════════════
//  ADMIN ROUTES — Kelola subjects per user
// ════════════════════════════════════════════════════════════════

/**
 * GET /api/subjects/user/:userId
 * Ambil subjects beserta status aktif/nonaktif untuk user tertentu (admin only)
 */
router.get("/user/:userId", authenticateToken, requireAdmin, (req, res) => {
  const { userId } = req.params;

  try {
    // Tampilkan semua subject aktif + status enabled untuk user ini
    const subjects = db
      .prepare(
        `
        SELECT
          s.id,
          s.name,
          s.pattern,
          s.description,
          s.is_active,
          COALESCE(us.is_enabled, 0) AS is_enabled
        FROM subjects s
        LEFT JOIN user_subjects us ON s.id = us.subject_id AND us.user_id = ?
        WHERE s.is_active = 1
        ORDER BY s.name ASC
      `,
      )
      .all(userId);

    res.json(subjects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil subjects user" });
  }
});

/**
 * POST /api/subjects/user/:userId
 * Set subjects yang diizinkan untuk user (admin only)
 * Body: { subjectIds: [1, 2, 3] }  — ID subject yang DIAKTIFKAN
 */
router.post("/user/:userId", authenticateToken, requireAdmin, (req, res) => {
  const { userId } = req.params;
  const { subjectIds } = req.body;

  if (!Array.isArray(subjectIds)) {
    return res.status(400).json({ error: "subjectIds harus berupa array" });
  }

  try {
    // Cek user ada
    const user = db
      .prepare("SELECT id FROM users WHERE id = ? AND role = 'user'")
      .get(userId);
    if (!user) {
      return res.status(404).json({ error: "User tidak ditemukan" });
    }

    // Ambil semua subject yang tersedia
    const allSubjects = db
      .prepare("SELECT id FROM subjects WHERE is_active = 1")
      .all();

    // Gunakan transaksi untuk batch update
    const upsert = db.transaction(() => {
      const insertOrReplace = db.prepare(`
        INSERT INTO user_subjects (user_id, subject_id, is_enabled)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, subject_id) DO UPDATE SET is_enabled = excluded.is_enabled
      `);

      for (const s of allSubjects) {
        const isEnabled = subjectIds.includes(s.id) ? 1 : 0;
        insertOrReplace.run(userId, s.id, isEnabled);
      }
    });

    upsert();

    res.json({ message: "Subjects user berhasil diupdate" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengupdate subjects user" });
  }
});

// ════════════════════════════════════════════════════════════════
//  HELPER — Digunakan oleh email search logic
// ════════════════════════════════════════════════════════════════

/**
 * GET /api/subjects/me/patterns
 * Ambil keyword patterns yang diizinkan untuk user yang sedang login
 * Digunakan oleh email search untuk memfilter pencarian
 */
router.get("/me/patterns", authenticateToken, (req, res) => {
  try {
    let patterns;

    if (req.user.role === "admin") {
      // Admin bisa akses semua pattern aktif
      patterns = db
        .prepare("SELECT pattern FROM subjects WHERE is_active = 1")
        .all()
        .map((r) => r.pattern.toLowerCase());
    } else {
      // User hanya dapat pattern yang diaktifkan untuknya
      patterns = db
        .prepare(
          `
          SELECT s.pattern
          FROM subjects s
          INNER JOIN user_subjects us ON s.id = us.subject_id
          WHERE us.user_id = ? AND us.is_enabled = 1 AND s.is_active = 1
        `,
        )
        .all(req.user.id)
        .map((r) => r.pattern.toLowerCase());
    }

    res.json({ patterns });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil patterns" });
  }
});

module.exports = router;
