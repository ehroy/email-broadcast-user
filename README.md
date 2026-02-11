# 📧 Email OTP Broadcast System

Sistem broadcast email untuk menerima dan mengelola OTP/kode verifikasi dengan filter keyword tertentu.

## ✨ Fitur

### 🔐 User (Role User)

- ✅ Login dengan username & password
- ✅ Melihat pesan email dengan keyword yang diizinkan
- ✅ Search/filter pesan
- ✅ Auto-refresh setiap 10 detik
- ✅ Hanya menampilkan email 15 menit terakhir (real-time dari IMAP)
- ✅ View detail pesan
- ℹ️ Email di-fetch langsung dari server (tidak disimpan di database)

### 👑 Admin (Role Admin)

- ✅ Semua fitur user
- ✅ Melihat semua pesan tanpa batasan keyword
- ✅ Kelola users (create, update permissions, delete)
- ✅ **Control email access** - Set alamat email yang boleh diakses per user
- ✅ **Control keyword access** - Set keyword yang boleh diakses per user
- ✅ Dashboard lengkap untuk monitoring

## 🔒 Keamanan & Anti-Exploit

**Fitur keamanan untuk mencegah akses email orang lain:**

1. **Allowed Emails Filter**: Admin wajib setting alamat email yang boleh diakses user
   - User hanya bisa lihat email dari alamat yang diizinkan
   - Contoh: User A hanya bisa akses email dari `noreply@facebook.com, support@instagram.com`
   - User B hanya bisa akses dari `notifications@twitter.com`

2. **Allowed Keywords Filter**: Admin bisa batasi keyword yang boleh diakses
   - User hanya lihat pesan dengan keyword tertentu
   - Contoh: `otp, verification code, kode verifikasi`

3. **Double Filter**: Pesan harus match **BOTH** email dan keyword
   - Email harus dari alamat yang diizinkan **DAN**
   - Pesan harus mengandung keyword yang diizinkan
   - Jika salah satu tidak match, user tidak bisa akses

4. **Time Limit**: Hanya email 15 menit terakhir yang disimpan dan bisa diakses

## 🚀 Teknologi

**Backend:**

- Node.js + Express
- SQLite (better-sqlite3) - hanya untuk users & permissions
- IMAP (untuk fetch email real-time)
- JWT Authentication
- bcrypt (password hashing)
- **No message storage** - Email di-fetch on-demand dari IMAP

**Frontend:**

- Vue.js 3 (Composition API)
- Pinia (state management)
- Vue Router
- Axios

## 📦 Instalasi

### 1. Backend Setup

```bash
cd backend
npm install
```

### 2. Konfigurasi Email

Copy file `.env.example` menjadi `.env`:

```bash
cp .env.example .env
```

Edit file `.env` dengan kredensial email Anda:

```env
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this

# Admin Default
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Email IMAP Configuration
IMAP_USER=your-email@gmail.com
IMAP_PASSWORD=your-app-password
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_TLS=true

# Auto-refresh interval (milliseconds)
EMAIL_CHECK_INTERVAL=30000
```

**⚠️ Penting untuk Gmail:**

1. Aktifkan 2-Factor Authentication di akun Google
2. Generate "App Password" di https://myaccount.google.com/apppasswords
3. Gunakan App Password sebagai `IMAP_PASSWORD`

### 3. Jalankan Backend

```bash
cd backend
npm start

# Atau untuk development dengan auto-reload:
npm run dev
```

Backend akan berjalan di `http://localhost:3000`

### 4. Frontend Setup

```bash
cd frontend
npm install
```

### 5. Jalankan Frontend

```bash
cd frontend
npm run dev
```

Frontend akan berjalan di `http://localhost:5173`

## 🎯 Cara Penggunaan

### Login

**Default Admin:**

- Username: `admin`
- Password: `admin123`

### Sebagai Admin

1. **Login** dengan kredensial admin
2. **Kelola Users:**
   - Klik tab "Users"
   - Klik "Buat User Baru"
   - Isi username, password, **allowed emails (wajib)**, dan allowed keywords
   - **Contoh allowed emails**: `noreply@facebook.com, support@instagram.com, notifications@twitter.com`
   - **Contoh keywords**: `otp, verification code, kode verifikasi`
   - User hanya bisa akses email dari alamat yang diizinkan dengan keyword yang sesuai

3. **Melihat Pesan:**
   - Klik tab "Pesan"
   - Lihat semua email yang masuk (15 menit terakhir)
   - Klik pesan untuk melihat detail
   - Hapus pesan jika diperlukan

### Sebagai User

1. **Login** dengan kredensial yang diberikan admin
2. **Melihat Pesan:**
   - Hanya pesan dengan keyword yang diizinkan akan muncul
   - Gunakan search untuk filter pesan
   - Auto-refresh setiap 10 detik
   - Klik pesan untuk detail lengkap
   - Email di-fetch real-time dari server (tidak disimpan)

3. **Catatan:**
   - Email otomatis hilang setelah 15 menit
   - Pesan tidak bisa dihapus manual (read-only dari IMAP)

## 🔧 Konfigurasi Email

### Gmail

```env
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_TLS=true
```

### Outlook/Hotmail

```env
IMAP_HOST=outlook.office365.com
IMAP_PORT=993
IMAP_TLS=true
```

### Yahoo

```env
IMAP_HOST=imap.mail.yahoo.com
IMAP_PORT=993
IMAP_TLS=true
```

## 📋 Keyword & Email Permission System

Sistem secara otomatis mendeteksi keywords berikut:

- `otp`
- `verification code`
- `kode verifikasi`
- `verification`
- `verifikasi`
- `password reset`
- `reset password`
- `kode otp`
- `authentication code`
- `security code`
- `confirm`
- `konfirmasi`
- `contains_code` (jika ada angka 4-8 digit)

**Admin memberikan akses berbasis:**

1. **Email Address**: User hanya bisa akses email dari alamat tertentu
   - User A: `noreply@facebook.com, support@instagram.com`
   - User B: `notifications@twitter.com, alerts@linkedin.com`

2. **Keywords**: User hanya bisa akses pesan dengan keyword tertentu
   - User A: `otp, verification code`
   - User B: `password reset, reset password`

3. **Kombinasi Keduanya**: Pesan harus match **KEDUANYA**
   - Email dari alamat yang diizinkan **DAN** mengandung keyword yang diizinkan
   - Ini mencegah user mengakses email orang lain

## 🛡️ Keamanan

- ✅ Password di-hash dengan bcrypt
- ✅ JWT authentication untuk API
- ✅ **Double filter**: User hanya bisa akses email dari alamat yang diizinkan + keyword yang sesuai
- ✅ **Wajib set allowed emails**: Admin harus set alamat email untuk setiap user
- ✅ **No email storage**: Email tidak disimpan di database, di-fetch real-time dari IMAP
- ✅ Hanya email 15 menit terakhir yang bisa diakses
- ✅ CORS protection
- ✅ SQL injection protection (prepared statements)
- ✅ **Anti-exploit**: Mencegah user mengakses email orang lain dengan filter email & keyword
- ✅ **Read-only**: User tidak bisa hapus/modifikasi email di server

## 📂 Struktur Project

```
email-otp-broadcast/
├── backend/
│   ├── database.js           # Database setup & initialization
│   ├── server.js             # Main server
│   ├── .env.example          # Environment variables template
│   ├── package.json
│   ├── middleware/
│   │   └── auth.js           # JWT authentication
│   ├── routes/
│   │   ├── auth.js           # Login, user management
│   │   └── messages.js       # Message CRUD
│   └── services/
│       └── emailService.js   # IMAP email fetching
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.js
        ├── App.vue
        ├── router/
        │   └── index.js      # Vue Router
        ├── stores/
        │   └── auth.js       # Pinia store
        └── views/
            ├── Login.vue
            ├── UserDashboard.vue
            └── AdminDashboard.vue
```

## 🐛 Troubleshooting

### Email tidak terbaca

1. Pastikan kredensial IMAP benar
2. Untuk Gmail, gunakan App Password bukan password biasa
3. Cek firewall tidak memblokir port 993
4. Pastikan IMAP enabled di email provider

### Auto-refresh tidak jalan

1. Cek console browser untuk error
2. Pastikan backend berjalan
3. Cek network tab untuk failed requests

### User tidak bisa lihat pesan

1. Pastikan admin sudah set allowed keywords untuk user
2. Cek apakah email memiliki keyword yang sesuai
3. Pastikan email dalam rentang 15 menit terakhir

## 📝 API Endpoints

### Authentication

- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/users` - Create user (admin)
- `GET /api/auth/users` - Get all users (admin)
- `PUT /api/auth/users/:id/permissions` - Update permissions (admin)
- `DELETE /api/auth/users/:id` - Delete user (admin)

### Messages

- `GET /api/messages` - Get messages (filtered by permissions)
- `GET /api/messages/:id` - Get single message
- `DELETE /api/messages/:id` - Delete message
- `DELETE /api/messages/cleanup/old` - Cleanup old messages

## 🎨 Customize

### Ubah interval auto-refresh

Edit di `.env`:

```env
EMAIL_CHECK_INTERVAL=30000  # 30 detik
```

Edit di `UserDashboard.vue`:

```javascript
refreshInterval = setInterval(() => {
  if (autoRefresh.value) {
    fetchMessages();
  }
}, 10000); // 10 detik
```

### Ubah batas waktu pesan (default 15 menit)

Edit di `services/emailService.js`:

```javascript
const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
```

Dan di `routes/messages.js`:

```javascript
WHERE datetime(received_date) >= datetime('now', '-15 minutes')
```

## 📄 License

MIT License - Bebas digunakan untuk personal maupun komersial.

## 🤝 Kontribusi

Pull requests welcome! Untuk perubahan besar, buka issue terlebih dahulu.

---

**Dibuat dengan ❤️ menggunakan Node.js & Vue.js**
