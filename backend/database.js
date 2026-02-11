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
      allowed_keywords TEXT NOT NULL,
      allowed_emails TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Note: Messages tidak perlu disimpan di database
  // Langsung fetch dari IMAP saat diperlukan

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
