const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");

const db = new Database(path.join(__dirname, "database.db"));

// Enable foreign keys
db.pragma("foreign_keys = ON");

// Initialize database tables
function initDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User permissions table (untuk control keyword dan email per user)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      allowed_keywords TEXT NOT NULL DEFAULT '',
      allowed_emails TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ─── BARU: Subjects table ───────────────────────────────────────────────────
  // Menyimpan daftar subject/keyword pattern yang tersedia
  db.exec(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      pattern TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─── BARU: User-Subject mapping ───────────────────────────────────────────
  // Menentukan subject mana yang diaktifkan untuk tiap user
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, subject_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    )
  `);

  // ─── Seed default subjects (dari keywordPatterns yang sudah ada) ──────────
  const defaultSubjects = [
    {
      name: "Netflix - Kode Akses Sementara (ID)",
      pattern: "Kode akses sementara Netflix-mu",
      description: "Email kode akses sementara Netflix bahasa Indonesia",
    },
    {
      name: "Netflix - Temporary Access Code (EN)",
      pattern: "Your Netflix temporary access code",
      description: "Netflix temporary access code email in English",
    },
    {
      name: "Netflix - Update Rumah Tangga (ID)",
      pattern: "Penting: Cara memperbarui Rumah dengan Akun Netflix-mu",
      description: "Notifikasi update rumah tangga Netflix bahasa Indonesia",
    },
    {
      name: "Netflix - Update Household (EN)",
      pattern: "Important: How to update your Netflix Household",
      description: "Netflix household update notification in English",
    },
    {
      name: "Netflix - Update Household (EN lowercase)",
      pattern: "Important: how to update your Netflix household",
      description: "Netflix household update notification (variant lowercase)",
    },
    {
      name: "Netflix - Kode Masuk (ID)",
      pattern: "Netflix: Kode masukmu",
      description: "Kode sign-in Netflix bahasa Indonesia",
    },
    {
      name: "Netflix - Sign-in Code (EN)",
      pattern: "Netflix: Your sign-in code",
      description: "Netflix sign-in code email in English",
    },
    {
      name: "Netflix - Reset Password (EN)",
      pattern: "Complete your password reset request",
      description: "Netflix password reset request email",
    },
    {
      name: "Netflix - Reset Sandi (ID)",
      pattern: "Selesaikan permintaanmu untuk mengatur ulang sandi",
      description: "Email reset sandi Netflix bahasa Indonesia",
    },
  ];

  const insertSubject = db.prepare(`
    INSERT OR IGNORE INTO subjects (name, pattern, description)
    VALUES (?, ?, ?)
  `);

  for (const s of defaultSubjects) {
    insertSubject.run(s.name, s.pattern, s.description);
  }

  // Create default admin if not exists
  const adminExists = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get("admin");
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync("admin123", 10);
    db.prepare(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
    ).run("admin", hashedPassword, "admin");
    console.log("Default admin created: username=admin, password=admin123");
  }
}

initDatabase();

module.exports = db;
