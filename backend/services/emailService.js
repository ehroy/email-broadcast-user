const Imap = require("imap");
const { simpleParser } = require("mailparser");
const db = require("../database");
require("dotenv").config({ path: "./backend/.env" });

class EmailService {
  constructor() {
    this.imap = null;
    this.isConnected = false;
  }

  // ════════════════════════════════════════════════════════════════
  //  CONNECT
  // ════════════════════════════════════════════════════════════════
  connect() {
    return new Promise((resolve, reject) => {
      this.imap = new Imap({
        user: process.env.IMAP_USER,
        password: process.env.IMAP_PASSWORD,
        host: process.env.IMAP_HOST,
        port: parseInt(process.env.IMAP_PORT),
        tls: process.env.IMAP_TLS === "true",
        tlsOptions: { rejectUnauthorized: false },
      });

      this.imap.once("ready", () => {
        this.isConnected = true;
        console.log("✓ IMAP Connected");
        resolve();
      });

      this.imap.once("error", (err) => {
        console.error("IMAP Error:", err);
        this.isConnected = false;
        reject(err);
      });

      this.imap.once("end", () => {
        this.isConnected = false;
        console.log("IMAP Connection ended");
      });

      this.imap.connect();
    });
  }

  // ════════════════════════════════════════════════════════════════
  //  HELPER: Ambil keyword patterns dari DB sesuai user/role
  //  - admin  → semua subjects aktif
  //  - user   → hanya subjects yang di-enable untuk user tsb
  // ════════════════════════════════════════════════════════════════
  getKeywordPatternsForUser(userId, role) {
    try {
      if (role === "admin") {
        return db
          .prepare("SELECT pattern FROM subjects WHERE is_active = 1")
          .all()
          .map((r) => r.pattern.toLowerCase());
      }

      return db
        .prepare(
          `SELECT s.pattern
           FROM subjects s
           INNER JOIN user_subjects us ON s.id = us.subject_id
           WHERE us.user_id = ?
             AND us.is_enabled = 1
             AND s.is_active = 1`,
        )
        .all(userId)
        .map((r) => r.pattern.toLowerCase());
    } catch (err) {
      console.error("getKeywordPatternsForUser error:", err);
      return [];
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  HELPER: Build OR criteria untuk imap.search
  // ════════════════════════════════════════════════════════════════
  buildOr(field, values) {
    if (!values || values.length === 0) return null;
    if (values.length === 1) return [field, values[0]];

    let result = ["OR", [field, values[0]], [field, values[1]]];
    for (let i = 2; i < values.length; i++) {
      result = ["OR", result, [field, values[i]]];
    }
    return result;
  }

  // ════════════════════════════════════════════════════════════════
  //  FETCH RECENT EMAILS
  //  Params:
  //    to            {string[]}  - daftar allowed emails (filter TO)
  //    subject       {string[]}  - override subject patterns (opsional)
  //    minutes       {number}    - rentang waktu dari sekarang
  //    userId        {number}    - id user pemanggil
  //    userRole      {string}    - "admin" | "user"
  //    allowedEmails {string[]}  - whitelist to_email untuk double-filter
  //                                (diisi untuk role "user", kosong untuk admin)
  // ════════════════════════════════════════════════════════════════
  async fetchRecentEmails({
    to = [],
    subject = [],
    minutes = 15,
    userId = null,
    userRole = "user",
    allowedEmails = [],
  } = {}) {
    if (!this.isConnected) await this.connect();

    const allowedPatterns =
      subject.length > 0
        ? subject.map((s) => s.toLowerCase())
        : this.getKeywordPatternsForUser(userId, userRole);

    if (allowedPatterns.length === 0) {
      console.warn(
        `fetchRecentEmails: no allowed patterns for userId=${userId}`,
      );
      return [];
    }

    return new Promise((resolve, reject) => {
      this.imap.openBox("HOUSEHOLD", false, (err) => {
        if (err) return reject(err);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const searchCriteria = [["SINCE", today]];

        const subjectOr = this.buildOr("SUBJECT", allowedPatterns);
        const toOr = this.buildOr("TO", to);

        // Admin: OR (subject cocok ATAU to cocok) — lebih luas
        // User : AND — IMAP filter TO dulu, subject difilter saat parsing
        if (userRole === "admin") {
          if (subjectOr && toOr) {
            searchCriteria.push(["OR", subjectOr, toOr]);
          } else if (subjectOr) {
            searchCriteria.push(subjectOr);
          } else if (toOr) {
            searchCriteria.push(toOr);
          }
        } else {
          // User: filter TO di IMAP level (AND implisit karena array criteria)
          if (toOr) searchCriteria.push(toOr);
          if (subjectOr) searchCriteria.push(subjectOr);
        }

        console.log(
          "fetchRecentEmails SEARCH:",
          JSON.stringify(searchCriteria),
        );

        this.imap.search(searchCriteria, (err, results) => {
          if (err) return reject(err);
          if (!results || results.length === 0) return resolve([]);

          const latest = results.slice(-10);
          const fetch = this.imap.fetch(latest, {
            bodies: "",
            markSeen: false,
          });

          const emails = [];
          const now = Date.now();
          const maxAge = minutes * 60 * 1000;

          fetch.on("message", (msg, seqno) => {
            msg.on("body", (stream) => {
              simpleParser(stream, (err, parsed) => {
                if (err || !parsed) return;

                const emailTime = parsed.date
                  ? new Date(parsed.date).getTime()
                  : now;
                if (now - emailTime > maxAge) return;

                const subjectLower = (parsed.subject || "").toLowerCase();
                const toEmailLower = (parsed.to?.text || "").toLowerCase();

                // ── Filter 1: subject harus cocok dengan pattern yang diizinkan ──
                const subjectOk = allowedPatterns.some((p) =>
                  subjectLower.includes(p),
                );
                if (!subjectOk) return;

                // ── Filter 2 (user only): to_email harus masuk allowedEmails ──
                if (userRole !== "admin" && allowedEmails.length > 0) {
                  const toOk = allowedEmails.some((ae) =>
                    toEmailLower.includes(ae),
                  );
                  if (!toOk) return;
                }

                const keywords = this.extractKeywords(
                  parsed.subject,
                  parsed.text,
                  allowedPatterns,
                );

                emails.push({
                  id: parsed.messageId || `msg_${seqno}_${Date.now()}`,
                  messageId: parsed.messageId,
                  subject: parsed.subject || "",
                  from_email: parsed.from?.text || "",
                  to_email: parsed.to?.text || "",
                  body: parsed.html || parsed.text || "",
                  received_date: parsed.date
                    ? parsed.date.toISOString()
                    : new Date().toISOString(),
                  keywords: keywords.join(","),
                });
              });
            });
          });

          fetch.once("error", reject);
          fetch.once("end", () => resolve(emails));
        });
      });
    });
  }

  // ════════════════════════════════════════════════════════════════
  //  SEARCH FETCH RECENT EMAILS
  //  Params:
  //    search        {string}    - alamat email tujuan yang dicari
  //    minutes       {number}    - rentang waktu dari sekarang
  //    userId        {number}    - id user pemanggil
  //    userRole      {string}    - "admin" | "user"
  //    allowedEmails {string[]}  - whitelist to_email untuk double-filter
  // ════════════════════════════════════════════════════════════════
  async searchFetchRecentEmails({
    search = null,
    minutes = 15,
    userId = null,
    userRole = "user",
    allowedEmails = [],
  } = {}) {
    if (!this.isConnected) await this.connect();

    const allowedPatterns = this.getKeywordPatternsForUser(userId, userRole);

    if (allowedPatterns.length === 0) {
      console.warn(
        `searchFetchRecentEmails: no allowed patterns for userId=${userId}`,
      );
      return [];
    }

    // Untuk user: search harus ada di dalam allowedEmails
    if (userRole !== "admin" && allowedEmails.length > 0 && search) {
      const searchLower = search.toLowerCase();
      const isEmailAllowed = allowedEmails.some(
        (ae) => searchLower.includes(ae) || ae.includes(searchLower),
      );
      if (!isEmailAllowed) {
        console.warn(
          `searchFetchRecentEmails: "${search}" tidak ada di allowedEmails user ${userId}`,
        );
        return [];
      }
    }

    return new Promise((resolve, reject) => {
      this.imap.openBox("HOUSEHOLD", false, (err) => {
        if (err) return reject(err);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const searchCriteria = [["SINCE", today]];

        if (search) {
          searchCriteria.push(["TO", search]);
        }

        console.log(
          "searchFetchRecentEmails SEARCH:",
          JSON.stringify(searchCriteria),
        );

        this.imap.search(searchCriteria, (err, results) => {
          if (err) return reject(err);
          if (!results || results.length === 0) return resolve([]);

          const latest = results.slice(-10);
          const fetch = this.imap.fetch(latest, {
            bodies: "",
            markSeen: false,
          });

          const emails = [];
          const now = Date.now();
          const maxAge = minutes * 60 * 1000;

          fetch.on("message", (msg, seqno) => {
            msg.on("body", (stream) => {
              simpleParser(stream, (err, parsed) => {
                if (err || !parsed) return;

                const emailTime = parsed.date
                  ? new Date(parsed.date).getTime()
                  : now;
                if (now - emailTime > maxAge) return;

                const subjectLower = (parsed.subject || "").toLowerCase();
                const toEmailLower = (parsed.to?.text || "").toLowerCase();

                // ── Filter 1: subject harus cocok dengan pattern yang diizinkan ──
                const subjectOk = allowedPatterns.some((p) =>
                  subjectLower.includes(p),
                );
                if (!subjectOk) return;

                // ── Filter 2 (user only): to_email harus masuk allowedEmails ──
                if (userRole !== "admin" && allowedEmails.length > 0) {
                  const toOk = allowedEmails.some((ae) =>
                    toEmailLower.includes(ae),
                  );
                  if (!toOk) return;
                }

                const keywords = this.extractKeywords(
                  parsed.subject,
                  parsed.text,
                  allowedPatterns,
                );

                emails.push({
                  id: parsed.messageId || `msg_${seqno}_${Date.now()}`,
                  messageId: parsed.messageId,
                  subject: parsed.subject || "",
                  from_email: parsed.from?.text || "",
                  to_email: parsed.to?.text || "",
                  body: parsed.html || parsed.text || "",
                  received_date: parsed.date
                    ? parsed.date.toISOString()
                    : new Date().toISOString(),
                  keywords: keywords.join(","),
                });
              });
            });
          });

          fetch.once("error", reject);
          fetch.once("end", () => resolve(emails));
        });
      });
    });
  }

  // ════════════════════════════════════════════════════════════════
  //  EXTRACT KEYWORDS
  //  Hanya menggunakan patterns yang diizinkan untuk user tsb.
  //  Jika tidak ada pattern yang cocok, fallback ke subject.
  // ════════════════════════════════════════════════════════════════
  extractKeywords(subject, body, allowedPatterns = null) {
    const text = `${subject || ""} ${body || ""}`.toLowerCase();
    const keywords = [];

    // Gunakan patterns yang diberikan, atau ambil semua dari DB sebagai fallback
    const patterns =
      allowedPatterns ||
      db
        .prepare("SELECT pattern FROM subjects WHERE is_active = 1")
        .all()
        .map((r) => r.pattern.toLowerCase());

    patterns.forEach((pattern) => {
      if (text.includes(pattern)) {
        keywords.push(pattern);
      }
    });

    // Fallback: jika tidak ada yang cocok, gunakan subject apa adanya
    if (keywords.length === 0 && subject) {
      keywords.push(subject.toLowerCase());
    }

    return [...new Set(keywords)];
  }

  // ════════════════════════════════════════════════════════════════
  //  DISCONNECT
  // ════════════════════════════════════════════════════════════════
  disconnect() {
    if (this.imap) {
      this.imap.end();
    }
  }
}

module.exports = new EmailService();
