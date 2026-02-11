# 🔒 Security & Anti-Exploit Guide

Dokumentasi lengkap tentang fitur keamanan Email OTP Broadcast System.

## 🛡️ Fitur Keamanan Utama

### 1. Double Permission Filter

**Sistem menggunakan 2 layer filter untuk setiap user:**

#### Layer 1: Allowed Emails
User **HANYA** bisa akses email dari alamat yang diizinkan admin.

```
Contoh:
- User A allowed emails: noreply@facebook.com, support@instagram.com
- User A TIDAK BISA akses email dari: notifications@twitter.com
```

#### Layer 2: Allowed Keywords  
User **HANYA** bisa akses email dengan keyword yang diizinkan.

```
Contoh:
- User A allowed keywords: otp, verification code
- User A TIDAK BISA akses email tanpa keyword ini
```

#### Kombinasi Keduanya
Email harus memenuhi **KEDUA** syarat:
- ✅ Email dari alamat yang diizinkan **AND**
- ✅ Email mengandung keyword yang diizinkan

**Contoh Skenario:**

```
Email masuk:
From: noreply@facebook.com
Subject: Your verification code is 123456
Body: Use code 123456 to verify...

User A permissions:
- Allowed emails: noreply@facebook.com
- Allowed keywords: otp, verification

Result: ✅ User A BISA AKSES (match keduanya)

---

Email masuk:
From: noreply@facebook.com  
Subject: Password reset request
Body: Click here to reset...

User A permissions:
- Allowed emails: noreply@facebook.com
- Allowed keywords: otp, verification

Result: ❌ User A TIDAK BISA AKSES (email match, tapi keyword tidak match)

---

Email masuk:
From: notifications@twitter.com
Subject: Your OTP is 456789
Body: OTP code: 456789

User A permissions:
- Allowed emails: noreply@facebook.com
- Allowed keywords: otp, verification

Result: ❌ User A TIDAK BISA AKSES (keyword match, tapi email tidak match)
```

### 2. Time-based Auto Cleanup

**Hanya email 15 menit terakhir yang tersimpan dan bisa diakses.**

Mengapa 15 menit?
- OTP biasanya expire dalam 5-10 menit
- Mengurangi surface area untuk exploit
- Auto-cleanup mencegah database membesar
- Privacy: data sensitif tidak tersimpan lama

### 3. Admin Control yang Ketat

**Admin WAJIB set allowed emails untuk setiap user.**

Backend akan reject request create user tanpa allowed_emails:
```javascript
if (!allowedEmails || allowedEmails.trim() === '') {
  return res.status(400).json({ 
    error: 'Allowed emails harus diisi untuk keamanan' 
  });
}
```

### 4. JWT Authentication

- Semua API endpoint dilindungi JWT
- Token expire dalam 24 jam
- User role checked untuk setiap request

### 5. Password Security

- Password di-hash dengan bcrypt (10 rounds)
- Tidak ada password yang tersimpan plain text
- Admin password harus diganti setelah setup

## 🚫 Skenario Exploit yang Dicegah

### Exploit 1: Akses Email Orang Lain

**Skenario:**
User jahat mencoba akses email pribadi orang lain dengan keyword umum.

**Pencegahan:**
```
User jahat permission:
- Allowed emails: noreply@facebook.com
- Allowed keywords: verification

Email orang lain masuk:
From: john.doe@gmail.com
Subject: Verification code 123456

Result: ❌ DITOLAK
Reason: Email tidak dari allowed_emails (noreply@facebook.com)
```

### Exploit 2: Keyword Spoofing

**Skenario:**
User mencoba gunakan keyword umum untuk lihat semua email.

**Pencegahan:**
```
User permission:
- Allowed emails: noreply@facebook.com
- Allowed keywords: verification

Email spam masuk:
From: noreply@facebook.com
Subject: Congratulations! You won verification prize!

Result: ❌ DITOLAK atau ✅ DIIZINKAN
(Tergantung apakah email benar-benar dari Facebook)

Admin sudah filter alamat email, jadi user hanya lihat email 
dari service yang legitimate sesuai permission.
```

### Exploit 3: Brute Force Access

**Pencegahan:**
- JWT dengan expiry
- Rate limiting bisa ditambahkan
- User tidak bisa ubah permission sendiri
- Hanya admin yang bisa manage permissions

### Exploit 4: SQL Injection

**Pencegahan:**
- Prepared statements untuk semua query
- Input validation
- Parameterized queries

```javascript
// ✅ Safe - Prepared statement
db.prepare('SELECT * FROM messages WHERE id = ?').get(id);

// ❌ Unsafe - String concatenation (TIDAK DIGUNAKAN)
db.exec(`SELECT * FROM messages WHERE id = ${id}`);
```

## 📋 Best Practices untuk Admin

### 1. Set Allowed Emails dengan Spesifik

**❌ Terlalu Luas:**
```
Allowed emails: gmail.com
```
Problem: User bisa akses SEMUA email dari domain gmail.com

**✅ Spesifik:**
```
Allowed emails: noreply@facebook.com, no-reply@accounts.google.com
```

### 2. Kombinasikan dengan Keyword

**❌ Hanya Email:**
```
Allowed emails: noreply@facebook.com
Allowed keywords: (kosong)
```
Problem: User bisa lihat SEMUA email dari Facebook

**✅ Email + Keyword:**
```
Allowed emails: noreply@facebook.com
Allowed keywords: otp, verification
```

### 3. Review Permissions Berkala

- Audit user permissions setiap bulan
- Hapus user yang tidak aktif
- Update allowed emails jika service berubah

### 4. Monitoring

- Cek logs untuk suspicious activity
- Monitor jumlah delete yang tidak wajar
- Track login attempts

## 🔧 Rekomendasi Deployment

### Production Security Checklist

- [ ] Ubah JWT_SECRET dengan string random 32+ karakter
- [ ] Ubah default admin password
- [ ] Enable HTTPS/SSL
- [ ] Setup rate limiting
- [ ] Enable firewall
- [ ] Restrict IMAP access ke IP server
- [ ] Regular database backup
- [ ] Log monitoring
- [ ] Update dependencies berkala

### Rate Limiting (Recommended)

Tambahkan di `server.js`:

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### CORS Production

Update `server.js`:

```javascript
app.use(cors({
  origin: 'https://your-domain.com',
  credentials: true
}));
```

## 🔍 Audit Log (Future Enhancement)

Untuk keamanan lebih baik, bisa ditambahkan audit logging:

```sql
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT,
  resource TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Track:
- Login attempts
- Message access
- Permission changes
- Delete operations

## ⚠️ Limitation & Known Issues

### Current Limitations:

1. **Email Partial Match**: 
   - System menggunakan LIKE query untuk email matching
   - `noreply@facebook.com` akan match email yang mengandung string ini
   - Solusi: Admin harus set email yang spesifik

2. **No Rate Limiting**:
   - Belum ada rate limiting built-in
   - Bisa ditambahkan dengan express-rate-limit

3. **No Audit Trail**:
   - Tidak ada logging untuk user actions
   - Pertimbangkan tambahkan audit logging

### Mitigasi:

Semua limitation di atas bisa diatasi dengan:
- Proper admin configuration
- Additional middleware (rate limiting)
- Database schema enhancement (audit logs)

## 📞 Security Report

Jika menemukan vulnerability:
1. JANGAN publish public
2. Report via private channel
3. Tunggu fix sebelum disclosure

---

**Security is a process, not a product.**

Regular audits, updates, dan monitoring adalah kunci keamanan jangka panjang.
