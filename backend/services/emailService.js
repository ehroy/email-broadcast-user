const Imap = require("imap");
const { simpleParser } = require("mailparser");
require("dotenv").config({ path: "./backend/.env" });

class EmailService {
  constructor() {
    this.imap = null;
    this.isConnected = false;
  }

  // =====================================
  // CONNECT
  // =====================================
  connect() {
    return new Promise((resolve, reject) => {
      this.imap = new Imap({
        user: process.env.IMAP_USER,
        password: process.env.IMAP_PASSWORD,
        host: process.env.IMAP_HOST,
        port: process.env.IMAP_PORT,
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

  // =====================================
  // BUILD OR
  // =====================================
  buildOr(field, values) {
    if (!values || values.length === 0) return null;
    if (values.length === 1) return [field, values[0]];

    let result = ["OR", [field, values[0]], [field, values[1]]];

    for (let i = 2; i < values.length; i++) {
      result = ["OR", result, [field, values[i]]];
    }

    return result;
  }

  // =====================================
  // FETCH EMAIL
  // =====================================
  async fetchRecentEmails({ to = [], subject = [], minutes = 15 } = {}) {
    if (!this.isConnected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      this.imap.openBox("INBOX", false, (err) => {
        if (err) return reject(err);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const searchCriteria = [["SINCE", today]];

        // OR SUBJECT
        const subjectOr = this.buildOr("SUBJECT", subject);

        // OR TO
        const toOr = this.buildOr("TO", to);

        // gabungkan
        if (subjectOr && toOr) {
          searchCriteria.push(["OR", subjectOr, toOr]);
        } else if (subjectOr) {
          searchCriteria.push(subjectOr);
        } else if (toOr) {
          searchCriteria.push(toOr);
        }

        console.log("SEARCH:", JSON.stringify(searchCriteria));

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

                // FILTER MENIT
                const emailTime = parsed.date
                  ? new Date(parsed.date).getTime()
                  : now;

                if (now - emailTime > maxAge) return;

                const keywords = this.extractKeywords(
                  parsed.subject,
                  parsed.text,
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

  // =====================================
  // EXTRACT KEYWORDS (NO OTP REGEX)
  // =====================================
  extractKeywords(subject, body) {
    const text = `${subject || ""} ${body || ""}`.toLowerCase();
    const keywords = [];

    const keywordPatterns = [
      "Kode akses sementara Netflix-mu",
      "Your Netflix temporary access code",
      "Penting: Cara memperbarui Rumah dengan Akun Netflix-mu",
      "Important: How to update your Netflix Household",
      "Important: how to update your Netflix household",
    ].map((k) => k.toLowerCase());

    keywordPatterns.forEach((keyword) => {
      if (text.includes(keyword)) {
        keywords.push(keyword);
      } else {
        keywords.push(subject); // fallback: ambil 30 karakter pertama sebagai keyword
      }
    });

    return [...new Set(keywords)];
  }

  // =====================================
  // DISCONNECT
  // =====================================
  disconnect() {
    if (this.imap) {
      this.imap.end();
    }
  }
}

module.exports = new EmailService();
