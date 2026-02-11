# 🚀 Quick Start Guide

## Instalasi Cepat

### 1️⃣ Extract & Setup

```bash
# Extract file
tar -xzf email-otp-broadcast.tar.gz
cd email-otp-broadcast

# Auto setup (Linux/Mac)
chmod +x setup.sh
./setup.sh

# Manual setup (Windows/All OS)
cd backend && npm install
cd ../frontend && npm install
```

### 2️⃣ Konfigurasi Email

Edit file `backend/.env`:

```env
# Untuk Gmail
IMAP_USER=youremail@gmail.com
IMAP_PASSWORD=your-16-digit-app-password
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_TLS=true
```

**📌 Cara dapat App Password Gmail:**
1. Buka https://myaccount.google.com/apppasswords
2. Pilih "Mail" dan "Other device"
3. Copy 16-digit password yang muncul
4. Paste ke IMAP_PASSWORD

### 3️⃣ Jalankan Aplikasi

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### 4️⃣ Akses Aplikasi

Buka browser: http://localhost:5173

**Login Admin:**
- Username: `admin`
- Password: `admin123`

## 📝 Workflow Penggunaan

### Sebagai Admin:

1. **Login** dengan admin/admin123
2. **Buat User Baru:**
   - Klik tab "Users"
   - Klik "+ Buat User Baru"
   - Isi:
     - Username: `user1`
     - Password: `password123`
     - **Allowed Emails**: `noreply@facebook.com, support@instagram.com` ⚠️ WAJIB
     - Keywords: `otp, verification code`
   - Klik "Buat User"

3. **Lihat Pesan:**
   - Klik tab "Pesan"
   - Semua email akan muncul
   - Klik pesan untuk detail
   - Hapus pesan jika perlu

**⚠️ Penting tentang Allowed Emails:**
- Admin WAJIB set allowed emails untuk setiap user
- User hanya bisa akses email dari alamat yang diizinkan
- Ini mencegah exploit/akses email orang lain
- Contoh: `noreply@facebook.com, notifications@twitter.com`

### Sebagai User:

1. **Login** dengan kredensial dari admin
2. **Lihat Pesan OTP:**
   - Hanya pesan dengan keyword yang diizinkan muncul
   - Auto-refresh setiap 10 detik
   - Search untuk filter
   - Klik untuk detail

## ⚙️ Konfigurasi

### Ubah Port

**Backend** - Edit `backend/.env`:
```env
PORT=5000
```

**Frontend** - Edit `frontend/vite.config.js`:
```javascript
server: {
  port: 8080
}
```

### Ubah Interval Check Email

Edit `backend/.env`:
```env
EMAIL_CHECK_INTERVAL=60000  # 60 detik
```

### Tambah Keyword

Edit `backend/services/emailService.js` di function `extractKeywords()`:
```javascript
const keywordPatterns = [
  'otp',
  'verification',
  'your-custom-keyword',  // Tambah di sini
  // ... dst
];
```

## 🔧 Commands Berguna

```bash
# Backend
cd backend
npm start              # Jalankan server
npm run dev           # Development mode (auto-reload)

# Frontend  
cd frontend
npm run dev           # Development server
npm run build         # Build untuk production
npm run preview       # Preview production build

# Database
sqlite3 backend/database.db "SELECT * FROM users;"
sqlite3 backend/database.db "SELECT * FROM messages LIMIT 10;"
```

## 📊 Monitoring

### Cek Health Backend
```bash
curl http://localhost:3000/api/health
```

### Lihat Logs
- Backend console akan menampilkan log koneksi IMAP
- Frontend console (browser) untuk debug

## ❓ Troubleshooting Cepat

| Problem | Solution |
|---------|----------|
| Email tidak masuk | Cek kredensial di `.env`, pastikan App Password benar |
| "Token tidak valid" | Logout dan login ulang |
| User tidak lihat pesan | Admin harus set allowed keywords untuk user |
| Port sudah digunakan | Ubah PORT di config |
| CORS error | Pastikan backend running di port 3000 |

## 🎯 Production Checklist

- [ ] Ubah JWT_SECRET di `.env`
- [ ] Ubah password admin default
- [ ] Setup HTTPS/SSL
- [ ] Setup reverse proxy (Nginx)
- [ ] Enable firewall
- [ ] Setup backup database
- [ ] Monitor logs
- [ ] Rate limiting

## 📚 Dokumentasi Lengkap

- README.md - Dokumentasi utama
- DEPLOYMENT.md - Panduan deployment production
- Backend API - Tersedia di endpoint `/api/*`

## 💡 Tips

1. **Gmail App Password** adalah password khusus 16 digit, bukan password Gmail biasa
2. **15 Menit Rule** - Hanya email 15 menit terakhir yang ditampilkan
3. **Double Filter** - User hanya lihat email yang match **email address + keyword**
4. **Allowed Emails WAJIB** - Admin harus set allowed emails untuk keamanan
5. **Auto Refresh** - Frontend auto refresh setiap 10 detik
6. **Delete Safety** - User hanya bisa hapus email dengan email & keyword yang diizinkan
7. **Anti-Exploit** - Sistem mencegah user akses email orang lain dengan filter ganda

## 🆘 Support

Jika ada masalah:
1. Cek logs di console backend & frontend
2. Pastikan semua dependencies ter-install
3. Verify email credentials
4. Check firewall & network settings

---

Selamat menggunakan! 🎉
