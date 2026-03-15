const Imap = require("imap");
const { simpleParser } = require("mailparser");
const db = require("../database");
require("dotenv").config({ path: "./backend/.env" });

// ════════════════════════════════════════════════════════════════
//  IN-MEMORY CACHE
//  TTL 45 detik — cukup untuk realtime, tidak stale terlalu lama
// ════════════════════════════════════════════════════════════════
const emailCache = new Map();
const CACHE_TTL_MS = 15 * 1000;

function getCached(key) {
  const entry = emailCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    emailCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key, data) {
  emailCache.set(key, { data, ts: Date.now() });
}

function invalidateCache(prefix = "") {
  if (!prefix) {
    emailCache.clear();
    return;
  }
  for (const key of emailCache.keys()) {
    if (key.startsWith(prefix)) emailCache.delete(key);
  }
}

class EmailService {
  constructor() {
    this.imap = null;
    this.isConnected = false;
    this.boxOpened = false;
    this._connectPromise = null; // mencegah race condition double-connect
  }

  // ════════════════════════════════════════════════════════════════
  // CONNECT — singleton promise, tidak buka koneksi ganda
  // ════════════════════════════════════════════════════════════════
  connect() {
    if (this.isConnected && this.imap) {
      return Promise.resolve();
    }

    if (this._connectPromise) {
      return this._connectPromise;
    }

    this._connectPromise = new Promise((resolve, reject) => {
      this.imap = new Imap({
        user: process.env.IMAP_USER,
        password: process.env.IMAP_PASSWORD,
        host: process.env.IMAP_HOST,
        port: parseInt(process.env.IMAP_PORT),
        tls: process.env.IMAP_TLS === "true",
        tlsOptions: { rejectUnauthorized: false },
        keepalive: true,
      });

      this.imap.once("ready", () => {
        this.isConnected = true;
        this._connectPromise = null;
        console.log("✓ IMAP Connected");

        // ✅ TARUH DI SINI — setelah ready, langsung pasang listener
        this.imap.on("mail", (numNewMsgs) => {
          console.log(
            `[IMAP] ${numNewMsgs} email baru masuk → invalidate cache`,
          );
          invalidateCache(); // bust semua cache, next request akan fetch ulang ke IMAP
        });

        // Opsional: kalau ada email yang dihapus/expired di server
        this.imap.on("expunge", () => {
          console.log("[IMAP] Email dihapus di server → invalidate cache");
          invalidateCache();
        });

        resolve();
      });

      this.imap.once("error", (err) => {
        console.error("IMAP Error:", err);
        this.isConnected = false;
        this.boxOpened = false;
        this._connectPromise = null;
        reject(err);
      });

      this.imap.once("end", () => {
        this.isConnected = false;
        this.boxOpened = false;
        this._connectPromise = null;
        console.log("IMAP Connection ended");
      });

      this.imap.connect();
    });

    return this._connectPromise;
  }

  // ════════════════════════════════════════════════════════════════
  // OPENBOX HELPER
  // ════════════════════════════════════════════════════════════════
  openBoxIfNeeded() {
    if (this.boxOpened) return Promise.resolve();

    return new Promise((resolve, reject) => {
      this.imap.openBox("HOUSEHOLD", false, (err) => {
        if (err) return reject(err);
        this.boxOpened = true;
        resolve();
      });
    });
  }

  // ════════════════════════════════════════════════════════════════
  // ENSURE READY — connect + openBox dalam satu helper
  // ════════════════════════════════════════════════════════════════
  async ensureReady() {
    if (!this.isConnected) await this.connect();
    await this.openBoxIfNeeded();
  }

  // ════════════════════════════════════════════════════════════════
  // GET SUBJECT PATTERNS
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
  // FETCH RECENT EMAILS — core method
  //
  // Perbaikan:
  //  1. Promise.all — tunggu semua simpleParser selesai sebelum resolve
  //  2. Cache per userId+role+allowedEmails key
  //  3. Trim body HTML tidak dikirim (pakai flag includBody)
  // ════════════════════════════════════════════════════════════════
  async fetchRecentEmails({
    to = [],
    subject = [],
    minutes = 15,
    userId = null,
    userRole = "user",
    allowedEmails = [],
    includeBody = true,
  } = {}) {
    await this.ensureReady();

    // Cache key unik per kombinasi parameter
    const cacheKey = `fetch_${userId}_${userRole}_${minutes}_${allowedEmails.join("|")}`;
    const cached = getCached(cacheKey);
    if (cached) {
      console.log(`[Cache HIT] ${cacheKey} → ${cached.length} emails`);
      return cached;
    }

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
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      this.imap.search([["SINCE", today]], (err, results) => {
        if (err) return reject(err);
        if (!results || results.length === 0) return resolve([]);

        // Ambil max 20 email terbaru
        const latest = results.slice(-20);

        const fetch = this.imap.fetch(latest, {
          bodies: "",
          markSeen: false,
        });

        const parsePromises = [];
        const now = Date.now();
        const maxAge = minutes * 60 * 1000;

        fetch.on("message", (msg, seqno) => {
          // Setiap message dibungkus Promise → dikumpulkan di array
          const p = new Promise((resMsg) => {
            msg.on("body", (stream) => {
              simpleParser(stream)
                .then((parsed) => {
                  if (!parsed) return resMsg(null);

                  // ── Filter waktu ──────────────────────────────
                  const emailTime = parsed.date
                    ? new Date(parsed.date).getTime()
                    : now;

                  if (now - emailTime > maxAge) return resMsg(null);

                  const subjectLower = (parsed.subject || "").toLowerCase();
                  const toEmailLower = (parsed.to?.text || "").toLowerCase();

                  // ── Filter subject/pattern ────────────────────
                  const subjectOk = allowedPatterns.some((p) =>
                    subjectLower.includes(p),
                  );
                  if (!subjectOk) return resMsg(null);

                  // ── Filter TO untuk non-admin ─────────────────
                  if (userRole !== "admin" && allowedEmails.length > 0) {
                    const toOk = allowedEmails.some((ae) =>
                      toEmailLower.includes(ae),
                    );
                    if (!toOk) return resMsg(null);
                  }

                  const keywords = this.extractKeywords(
                    parsed.subject,
                    parsed.text,
                    allowedPatterns,
                  );

                  resMsg({
                    id: parsed.messageId || `msg_${seqno}_${Date.now()}`,
                    messageId: parsed.messageId,
                    subject: parsed.subject || "",
                    from_email: parsed.from?.text || "",
                    to_email: parsed.to?.text || "",
                    // Body hanya disertakan kalau dibutuhkan
                    body: includeBody ? parsed.html || parsed.text || "" : "",
                    received_date: parsed.date
                      ? parsed.date.toISOString()
                      : new Date().toISOString(),
                    keywords: keywords.join(","),
                  });
                })
                .catch(() => resMsg(null)); // error parsing → skip
            });

            // Kalau tidak ada body event (edge case)
            msg.once("error", () => resMsg(null));
          });

          parsePromises.push(p);
        });

        fetch.once("error", reject);

        // ── Tunggu SEMUA message selesai di-parse ─────────────────
        fetch.once("end", async () => {
          try {
            const settled = await Promise.all(parsePromises);
            const emails = settled.filter(Boolean); // buang null

            console.log(
              `[IMAP] Fetched ${emails.length} emails (userId=${userId}, role=${userRole})`,
            );

            // Simpan ke cache
            setCached(cacheKey, emails);

            resolve(emails);
          } catch (e) {
            reject(e);
          }
        });
      });
    });
  }

  // ════════════════════════════════════════════════════════════════
  // USER FETCH RECENT EMAILS
  // Delegate ke fetchRecentEmails — tidak perlu connect ulang
  // ════════════════════════════════════════════════════════════════
  async userFetchRecentEmails(options = {}) {
    return this.fetchRecentEmails(options);
  }

  // ════════════════════════════════════════════════════════════════
  // SEARCH FETCH RECENT EMAILS
  //
  // Perbaikan:
  //  - Tidak lagi memanggil getKeywordPatternsForUser dua kali
  //  - Tidak scan body (mahal) → gunakan keywords + subject + email
  //  - Cache terpisah per search term
  // ════════════════════════════════════════════════════════════════
  async searchFetchRecentEmails({
    search = null,
    minutes = 15,
    userId = null,
    userRole = "user",
    allowedEmails = [],
  } = {}) {
    const searchLower = search ? search.toLowerCase().trim() : null;

    // Cache key sertakan search term
    const cacheKey = `search_${userId}_${userRole}_${minutes}_${allowedEmails.join("|")}_${searchLower || "all"}`;
    const cached = getCached(cacheKey);
    if (cached) {
      console.log(`[Cache HIT] ${cacheKey} → ${cached.length} emails`);
      return cached;
    }

    // Ambil base emails (sudah di-cache di fetchRecentEmails)
    const emails = await this.fetchRecentEmails({
      minutes,
      userId,
      userRole,
      allowedEmails,
      includeBody: false, // search tidak perlu body
    });

    if (!searchLower) return emails;

    // Filter berdasarkan keywords, subject, email — TIDAK scan body
    const filtered = emails.filter(
      (email) =>
        email.subject.toLowerCase().includes(searchLower) ||
        email.from_email.toLowerCase().includes(searchLower) ||
        email.to_email.toLowerCase().includes(searchLower) ||
        email.keywords.toLowerCase().includes(searchLower),
    );

    setCached(cacheKey, filtered);
    return filtered;
  }

  // ════════════════════════════════════════════════════════════════
  // EXTRACT KEYWORDS
  // ════════════════════════════════════════════════════════════════
  extractKeywords(subject, body, allowedPatterns = null) {
    const text = `${subject || ""} ${body || ""}`.toLowerCase();
    const keywords = [];

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

    if (keywords.length === 0 && subject) {
      keywords.push(subject.toLowerCase());
    }

    return [...new Set(keywords)];
  }

  // ════════════════════════════════════════════════════════════════
  // INVALIDATE CACHE — panggil manual kalau perlu refresh paksa
  // ════════════════════════════════════════════════════════════════
  clearCache(userId = null) {
    if (userId) {
      invalidateCache(`fetch_${userId}`);
      invalidateCache(`search_${userId}`);
      console.log(`[Cache] Invalidated for userId=${userId}`);
    } else {
      invalidateCache();
      console.log("[Cache] All cleared");
    }
  }
  // Jalankan sekali saat server start
  startBackgroundRefresh(intervalSeconds = 30) {
    setInterval(async () => {
      try {
        console.log("[BG Refresh] Refreshing email cache...");

        // Invalidate dulu biar fetchRecentEmails fetch ulang ke IMAP
        invalidateCache();

        // Fetch ulang untuk setiap user aktif
        const users = db.prepare("SELECT id, role FROM users").all();

        for (const user of users) {
          let allowedEmails = [];

          if (user.role !== "admin") {
            const perms = db
              .prepare(
                "SELECT allowed_emails FROM user_permissions WHERE user_id = ?",
              )
              .get(user.id);

            if (!perms?.allowed_emails?.trim()) continue;

            allowedEmails = perms.allowed_emails
              .split(",")
              .map((e) => e.trim().toLowerCase())
              .filter(Boolean);
          }

          await this.fetchRecentEmails({
            minutes: 120,
            userId: user.id,
            userRole: user.role,
            allowedEmails,
          });
        }

        console.log("[BG Refresh] Done");
      } catch (err) {
        console.error("[BG Refresh] Error:", err);
      }
    }, intervalSeconds * 1000);
  }
  // ════════════════════════════════════════════════════════════════
  // DISCONNECT
  // ════════════════════════════════════════════════════════════════
  disconnect() {
    if (this.imap) {
      this.imap.end();
    }
  }
}

module.exports = new EmailService();
