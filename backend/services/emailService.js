const Imap = require("imap");
const { simpleParser } = require("mailparser");
const db = require("../database");
require("dotenv").config({ path: "./backend/.env" });

// ════════════════════════════════════════════════════════════════
//  VARIABLES LUAR CLASS
// ════════════════════════════════════════════════════════════════
let _pushCallback = null;

const emailCache = new Map();
const CACHE_TTL_MS = 45 * 1000;

// Dedup: kalau ada fetch dengan key sama sedang berjalan,
// request berikutnya tunggu promise yang sama — tidak buka IMAP baru
const pendingFetches = new Map();

function getCached(key) {
  const entry = emailCache.get(key);
  if (!entry) {
    console.log(`[Cache MISS] key=${key}`);
    return null;
  }
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    emailCache.delete(key);
    console.log(`[Cache EXPIRED] key=${key}`);
    return null;
  }
  console.log(`[Cache HIT] key=${key} → ${entry.data.length} emails`);
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
    this._connectPromise = null;
  }

  // ════════════════════════════════════════════════════════════════
  // SET PUSH CALLBACK
  // ════════════════════════════════════════════════════════════════
  setPushCallback(fn) {
    _pushCallback = fn;
  }

  // ════════════════════════════════════════════════════════════════
  // CONNECT
  // ════════════════════════════════════════════════════════════════
  connect() {
    if (this.isConnected && this.imap) return Promise.resolve();
    if (this._connectPromise) return this._connectPromise;

    this._connectPromise = new Promise((resolve, reject) => {
      this.imap = new Imap({
        user: process.env.IMAP_USER,
        password: process.env.IMAP_PASSWORD,
        host: process.env.IMAP_HOST,
        port: parseInt(process.env.IMAP_PORT),
        tls: process.env.IMAP_TLS === "true",
        tlsOptions: { rejectUnauthorized: false },
        keepalive: true,
        connTimeout: 10000,
        authTimeout: 5000,
      });

      this.imap.once("ready", () => {
        this.isConnected = true;
        this._connectPromise = null;
        console.log("✓ IMAP Connected");

        // ── Realtime: email baru masuk ────────────────────────
        this.imap.on("mail", (numNewMsgs) => {
          console.log(`[IMAP] ${numNewMsgs} email baru → schedule invalidate`);
          setTimeout(() => {
            invalidateCache();
            if (_pushCallback) _pushCallback();
          }, 2000);
        });

        // ── Realtime: email dihapus di server ─────────────────
        this.imap.on("expunge", () => {
          console.log("[IMAP] Email dihapus → invalidate cache");
          setTimeout(() => {
            invalidateCache();
            if (_pushCallback) _pushCallback();
          }, 2000);
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
  // ENSURE READY
  // ════════════════════════════════════════════════════════════════
  async ensureReady() {
    if (!this.isConnected || !this.imap || this.imap.state === "disconnected") {
      this.isConnected = false;
      this.boxOpened = false;
      await this.connect();
    }
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
  // FETCH RECENT EMAILS
  //
  // Perbaikan:
  //  1. Promise.all — tunggu semua simpleParser selesai
  //  2. Cache per key unik
  //  3. Pending dedup — request bersamaan tunggu 1 promise saja
  // ════════════════════════════════════════════════════════════════
  async fetchRecentEmails({
    to = [],
    subject = [],
    minutes = 30,
    userId = null,
    userRole = "user",
    allowedEmails = [],
    includeBody = true,
  } = {}) {
    await this.ensureReady();

    const cacheKey = `fetch_${userId}_${userRole}_${minutes}_${allowedEmails.join("|")}`;

    // ── Cache hit ─────────────────────────────────────────────
    const cached = getCached(cacheKey);
    if (cached) return cached;

    // ── Pending dedup: request bersamaan tunggu promise sama ──
    if (pendingFetches.has(cacheKey)) {
      console.log(`[Pending HIT] ${cacheKey} — menunggu fetch sebelumnya`);
      return pendingFetches.get(cacheKey);
    }

    const allowedPatterns =
      subject.length > 0
        ? subject.map((s) => s.toLowerCase())
        : this.getKeywordPatternsForUser(userId, userRole);

    if (allowedPatterns.length === 0) {
      console.warn(
        `fetchRecentEmails: no allowed patterns untuk userId=${userId}`,
      );
      return [];
    }

    // ── Buat fetch promise dan simpan ke pending ──────────────
    const fetchPromise = new Promise((resolve, reject) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      this.imap.search([["SINCE", today]], (err, results) => {
        if (err) return reject(err);
        if (!results || results.length === 0) return resolve([]);

        const latest = results.slice(-20);

        const fetch = this.imap.fetch(latest, {
          bodies: "",
          markSeen: false,
        });

        const parsePromises = [];
        const now = Date.now();
        const maxAge = minutes * 60 * 1000;

        fetch.on("message", (msg, seqno) => {
          const p = new Promise((resMsg) => {
            msg.on("body", (stream) => {
              simpleParser(stream)
                .then((parsed) => {
                  if (!parsed) return resMsg(null);

                  // ── Filter waktu ────────────────────────────
                  const emailTime = parsed.date
                    ? new Date(parsed.date).getTime()
                    : now;
                  if (now - emailTime > maxAge) return resMsg(null);

                  const subjectLower = (parsed.subject || "").toLowerCase();
                  const toEmailLower = (parsed.to?.text || "").toLowerCase();

                  // ── Filter subject/pattern ──────────────────
                  const subjectOk = allowedPatterns.some((p) =>
                    subjectLower.includes(p),
                  );
                  if (!subjectOk) return resMsg(null);

                  // ── Filter TO untuk non-admin ───────────────
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
                    body: includeBody ? parsed.html || parsed.text || "" : "",
                    received_date: parsed.date
                      ? parsed.date.toISOString()
                      : new Date().toISOString(),
                    keywords: keywords.join(","),
                  });
                })
                .catch(() => resMsg(null));
            });

            msg.once("error", () => resMsg(null));
          });

          parsePromises.push(p);
        });

        fetch.once("error", reject);

        fetch.once("end", async () => {
          try {
            const settled = await Promise.all(parsePromises);
            const emails = settled.filter(Boolean);

            console.log(
              `[IMAP] Fetched ${emails.length} emails (userId=${userId}, role=${userRole})`,
            );

            setCached(cacheKey, emails);
            resolve(emails);
          } catch (e) {
            reject(e);
          }
        });
      });
    }).finally(() => {
      // Hapus dari pending setelah selesai (sukses maupun error)
      pendingFetches.delete(cacheKey);
    });

    pendingFetches.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  // ════════════════════════════════════════════════════════════════
  // USER FETCH RECENT EMAILS
  // ════════════════════════════════════════════════════════════════
  async userFetchRecentEmails(options = {}) {
    return this.fetchRecentEmails(options);
  }

  // ════════════════════════════════════════════════════════════════
  // SEARCH FETCH RECENT EMAILS
  //
  // Perbaikan:
  //  - Tidak double-fetch, tidak scan body
  //  - Filter dari keywords + subject + email saja
  // ════════════════════════════════════════════════════════════════
  async searchFetchRecentEmails({
    search = null,
    minutes = 30,
    userId = null,
    userRole = "user",
    allowedEmails = [],
  } = {}) {
    const searchLower = search ? search.toLowerCase().trim() : null;

    const cacheKey = `search_${userId}_${userRole}_${minutes}_${allowedEmails.join("|")}_${searchLower || "all"}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    // Ambil base emails — sudah di-cache dan di-dedup di fetchRecentEmails
    const emails = await this.fetchRecentEmails({
      minutes,
      userId,
      userRole,
      allowedEmails,
      includeBody: false,
    });

    if (!searchLower) return emails;

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
      if (text.includes(pattern)) keywords.push(pattern);
    });

    if (keywords.length === 0 && subject) {
      keywords.push(subject.toLowerCase());
    }

    return [...new Set(keywords)];
  }

  // ════════════════════════════════════════════════════════════════
  // BACKGROUND REFRESH — parallel fetch semua user sekaligus
  // ════════════════════════════════════════════════════════════════
  startBackgroundRefresh(intervalSeconds = 30) {
    let isRunning = false;

    setInterval(async () => {
      if (isRunning) {
        console.log("[BG Refresh] Skipped — masih proses sebelumnya");
        return;
      }

      isRunning = true;

      try {
        console.log("[BG Refresh] Start...");

        const users = db.prepare("SELECT id, role FROM users").all();

        // Fetch semua user paralel — bukan sequential
        await Promise.all(
          users.map(async (user) => {
            try {
              let allowedEmails = [];

              if (user.role !== "admin") {
                const perms = db
                  .prepare(
                    "SELECT allowed_emails FROM user_permissions WHERE user_id = ?",
                  )
                  .get(user.id);

                if (!perms?.allowed_emails?.trim()) return;

                allowedEmails = perms.allowed_emails
                  .split(",")
                  .map((e) => e.trim().toLowerCase())
                  .filter(Boolean);
              }

              await this.fetchRecentEmails({
                minutes: 30,
                userId: user.id,
                userRole: user.role,
                allowedEmails,
              });
            } catch (err) {
              console.error(
                `[BG Refresh] Error userId=${user.id}:`,
                err.message,
              );
            }
          }),
        );

        console.log("[BG Refresh] Done");
      } catch (err) {
        console.error("[BG Refresh] Error:", err);
      } finally {
        isRunning = false;
      }
    }, intervalSeconds * 1000);
  }

  // ════════════════════════════════════════════════════════════════
  // CLEAR CACHE
  // ════════════════════════════════════════════════════════════════
  clearCache(userId = null) {
    if (userId) {
      invalidateCache(`fetch_${userId}`);
      invalidateCache(`search_${userId}`);
      console.log(`[Cache] Invalidated untuk userId=${userId}`);
    } else {
      invalidateCache();
      console.log("[Cache] All cleared");
    }
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
