# 🚀 Deployment Guide

Panduan untuk deploy aplikasi Email OTP Broadcast ke production.

## 📋 Prerequisites

- Node.js 16+ 
- npm atau yarn
- Email account dengan IMAP access
- Server dengan akses internet

## 🔧 Production Setup

### 1. Backend Production

#### Environment Variables

Buat file `.env` di folder backend:

```env
# Production Settings
NODE_ENV=production
PORT=3000
JWT_SECRET=generate-random-secret-minimum-32-characters

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=strong-password-here

# Email IMAP
IMAP_USER=your-email@domain.com
IMAP_PASSWORD=your-app-password
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_TLS=true

# Performance
EMAIL_CHECK_INTERVAL=30000
```

#### Build & Run

```bash
cd backend
npm install --production
npm start
```

#### Dengan PM2 (Recommended)

```bash
npm install -g pm2

# Start backend
cd backend
pm2 start server.js --name email-otp-backend

# Auto-restart on reboot
pm2 startup
pm2 save

# Monitor
pm2 monit

# Logs
pm2 logs email-otp-backend
```

### 2. Frontend Production

#### Build

```bash
cd frontend
npm install
npm run build
```

Hasil build akan ada di folder `frontend/dist/`

#### Serve with Nginx

Install Nginx:
```bash
sudo apt install nginx
```

Config file `/etc/nginx/sites-available/email-otp`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /path/to/email-otp-broadcast/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/email-otp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. SSL dengan Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 🐳 Docker Deployment

### Docker Compose

Buat file `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - ./backend/.env
    volumes:
      - ./backend/database.db:/app/database.db
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
```

Backend Dockerfile (`backend/Dockerfile`):

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

Frontend Dockerfile (`frontend/Dockerfile`):

```dockerfile
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

Frontend nginx.conf (`frontend/nginx.conf`):

```nginx
server {
    listen 80;
    server_name localhost;

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Run dengan Docker:

```bash
docker-compose up -d
```

## 🔐 Security Best Practices

1. **JWT Secret**: Generate strong random secret
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

2. **Admin Password**: Ubah password default admin setelah deploy

3. **CORS**: Update CORS settings di `backend/server.js` untuk production domain

4. **Rate Limiting**: Tambahkan rate limiting untuk API

5. **HTTPS**: Selalu gunakan HTTPS di production

6. **Firewall**: Setup firewall untuk membatasi akses

## 📊 Monitoring

### Logs

Backend logs dengan PM2:
```bash
pm2 logs email-otp-backend
```

Nginx logs:
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Health Check

Tambahkan health check endpoint sudah tersedia:
```bash
curl http://localhost:3000/api/health
```

## 🔄 Update & Maintenance

### Update Aplikasi

```bash
# Pull latest code
git pull

# Update backend
cd backend
npm install
pm2 restart email-otp-backend

# Update frontend
cd ../frontend
npm install
npm run build

# Reload nginx
sudo systemctl reload nginx
```

### Database Backup

```bash
# Backup database
cp backend/database.db backend/database.db.backup

# Automated backup (add to crontab)
0 2 * * * cp /path/to/backend/database.db /path/to/backups/database-$(date +\%Y\%m\%d).db
```

## 🐛 Troubleshooting

### Backend tidak bisa connect ke email
- Cek credentials di `.env`
- Pastikan App Password digunakan (bukan password biasa)
- Cek firewall tidak block port 993

### Frontend tidak bisa akses API
- Cek CORS settings di backend
- Pastikan proxy settings benar
- Cek nginx config

### Database locked
- Restart PM2: `pm2 restart email-otp-backend`
- Check file permissions

## 📈 Performance Optimization

1. **Gzip Compression** (Nginx)
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript;
```

2. **Caching** (Nginx)
```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

3. **Database Optimization**
- Regular vacuum: `sqlite3 database.db "VACUUM;"`
- Index optimization

---

**Happy Deploying! 🚀**
