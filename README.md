# StreamHibV2

> **Tanggal Rilis**: 31/05/2025
> **Status**: Bismillah, dalam tahap pengembangan (StreamHibV2)
> **Fungsi**: Platform manajemen streaming berbasis Flask + FFmpeg, cocok untuk server Regxa, Contabo, Hetzner, dan Biznet.

---

## ✨ Fitur Utama

* Panel kontrol streaming berbasis web (Flask)
* Dilengkapi dengan WebSocket dan FFmpeg
* Instalasi mudah dan cepat di VPS berbasis Debian/Ubuntu
* Autostart service via `systemd`
* Transfer dan backup video dari server lama
* **🔄 Sistem Migrasi Seamless** - Recovery otomatis sesi dan jadwal
* **🚀 Migration Wizard** - Transfer data dari server lama dengan 1 klik
* **🌐 Sistem Domain Terintegrasi** - Support domain custom dengan SSL

---

## 🧱 Prasyarat

* Server berbasis Debian (Regxa, Contabo, Hetzner, Biznet)
* Akses root atau user dengan sudo
* SSH key aktif (khusus Biznet)
* Port 5000 terbuka untuk publik
* Domain (opsional, untuk akses yang lebih profesional)

---
### SINGLE INSTALLER

#### Download dan jalankan installer

```bash
wget https://raw.githubusercontent.com/emuhib/StreamHibV2/main/install_streamhib.sh

```
Gasskan

```bash
sudo bash install_streamhib.sh

```

## 🚀 Instalasi Lengkap Manual

### 1. Persiapan Awal (Opsional tergantung provider)

#### a. Untuk Regxa / Contabo

```bash
apt update && apt install sudo -y

```

#### b. Untuk Biznet

Login sebagai user (`emuhib`) lalu masuk root:

```bash
sudo su

```

Edit SSH config:

```bash
nano /etc/ssh/sshd_config

```

Ubah baris berikut:

```
PermitRootLogin yes
PasswordAuthentication yes

```

---

### 2. Update Sistem & Install Dependensi

```bash
sudo apt update && sudo apt upgrade -y && sudo apt dist-upgrade -y

```

```bash 
sudo apt install -y python3 python3-pip python3-venv ffmpeg git

```

```bash 
sudo pip3 install gdown

```

---

### 3. Clone Repository

```bash
git clone https://github.com/emuhib/StreamHibV2.git

```

```bash 
cd StreamHibV2

```

---

### 4. Setup Virtual Environment

```bash
python3 -m venv /root/StreamHibV2/venv

```

```bash 
source /root/StreamHibV2/venv/bin/activate

```

### 5. Install Dependensi Python

```bash
pip install flask flask-socketio flask-cors filelock apscheduler pytz gunicorn eventlet paramiko scp

```

---

### 6. Buka Firewall Port 5000 (Khusus di VULTR)

```bash
sudo ufw allow 5000
sudo ufw enable

```

---

### 7. Izin File Session (Khusus di VULTR)

```bash
chmod 777 sessions.json

```

---

### 8. Konfigurasi Systemd Service

Buat file service:

```bash
sudo nano /etc/systemd/system/StreamHibV2.service

```

Isi file:

```ini
[Unit]
Description=StreamHib Flask Service with Gunicorn
After=network.target

[Service]
ExecStart=/root/StreamHibV2/venv/bin/gunicorn --worker-class eventlet -w 1 -b 0.0.0.0:5000 app:app
WorkingDirectory=/root/StreamHibV2
Restart=always
User=root

[Install]
WantedBy=multi-user.target
```

---

### 9. Jalankan & Aktifkan Service

```bash
sudo systemctl daemon-reload

```

```bash 
sudo systemctl enable StreamHibV2.service

```

```bash 
sudo systemctl start StreamHibV2.service

```

---

## 🌐 Setup Domain (Opsional)

StreamHibV2 mendukung konfigurasi domain custom dengan SSL otomatis menggunakan Let's Encrypt.

### Cara Setup Domain:

#### 1. Persiapan Domain
- Pastikan domain Anda sudah mengarah ke IP server
- Buat A record: `yourdomain.com` → `IP_SERVER`
- Tunggu propagasi DNS (biasanya 5-15 menit)

#### 2. Setup melalui Web Interface
1. Login ke StreamHib panel
2. Masuk ke menu **Pengaturan Domain**
3. Masukkan nama domain (contoh: `streaming.yourdomain.com`)
4. Pilih apakah ingin mengaktifkan SSL
5. Klik **Setup Domain**

#### 3. Setup Manual via API
```bash
# Setup domain tanpa SSL
curl -X POST http://localhost:5000/api/domain/setup \
  -H "Content-Type: application/json" \
  -d '{
    "domain_name": "streaming.yourdomain.com",
    "ssl_enabled": false,
    "port": 5000
  }'

# Setup SSL setelah domain dikonfigurasi
curl -X POST http://localhost:5000/api/domain/ssl/setup
```

### Keunggulan Menggunakan Domain:

- ✅ **Akses Profesional**: `https://streaming.yourdomain.com` vs `http://123.456.789.0:5000`
- ✅ **SSL Otomatis**: Sertifikat Let's Encrypt gratis
- ✅ **Migrasi Seamless**: Customer tidak perlu tahu IP server berubah
- ✅ **Branding**: Menggunakan domain sendiri

### Contoh Skenario Customer:

**Sebelum (dengan IP):**
- Customer 1: `http://192.168.1.100:5000`
- Customer 2: `http://192.168.1.101:5000`

**Sesudah (dengan domain):**
- Customer 1: `https://customer1.streamhib.com`
- Customer 2: `https://customer2.streamhib.com`

Saat migrasi server, Anda hanya perlu mengubah A record domain, customer tidak perlu tahu perubahan IP!

---

## 🔄 Migrasi Server Seamless

StreamHibV2 dilengkapi dengan **Migration Wizard** dan sistem recovery otomatis yang memungkinkan migrasi server tanpa downtime yang signifikan.

### Cara Kerja Migrasi:

1. **Server A** (lama) tetap berjalan selama proses migrasi
2. **Server B** (baru) disetup dengan data yang sama
3. **Migration Wizard** otomatis transfer data via SSH
4. Sistem recovery otomatis mendeteksi dan memulihkan:
   - Sesi streaming yang terputus
   - Jadwal yang hilang
   - Service systemd yang tidak aktif

### Langkah Migrasi (Otomatis dengan Migration Wizard):

#### 1. Setup Server Baru (Server B)
```bash
# Install StreamHibV2 di server baru
sudo bash install_streamhib.sh
```

#### 2. Gunakan Migration Wizard
1. Login ke Admin Panel server baru
2. Masuk menu **Migration**
3. Input detail server lama:
   - IP Address server lama
   - Username (biasanya `root`)
   - Password server lama
4. Klik **Test Connection** untuk validasi
5. Klik **Start Migration** untuk mulai transfer
6. Tunggu proses selesai (real-time progress)
7. Klik **Start Recovery** untuk restore sessions

#### 3. Files yang Ditransfer Otomatis
- ✅ `sessions.json` - Data sesi dan jadwal
- ✅ `users.json` - Data user
- ✅ `domain_config.json` - Konfigurasi domain
- ✅ Semua video files (mp4, avi, mkv, mov)

#### 4. Update DNS (jika menggunakan domain)
```bash
# Update A record domain ke IP server baru
# Contoh menggunakan Cloudflare API:
curl -X PUT "https://api.cloudflare.com/client/v4/zones/ZONE_ID/dns_records/RECORD_ID" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"type":"A","name":"streaming.yourdomain.com","content":"NEW_SERVER_IP"}'
```

#### 5. Matikan Server Lama
Setelah memastikan semua berjalan normal di server baru, matikan server lama.

### Fitur Recovery Otomatis:

- **Deteksi Sesi Yatim**: Mendeteksi sesi yang ada di database tapi service-nya hilang
- **Pemulihan Service**: Membuat ulang service systemd yang hilang
- **Sinkronisasi Jadwal**: Memulihkan jadwal yang terputus
- **Validasi Data**: Memastikan data lengkap sebelum recovery
- **Recovery Berkala**: Berjalan otomatis setiap 5 menit

---

### 🔍 Perintah Tambahan

* **Cek status**:
  `sudo systemctl status StreamHibV2.service`

* **Stop Service**:
  `sudo systemctl stop StreamHibV2.service`

* **Restart Service**:
    ```bash
  sudo systemctl restart StreamHibV2.service

     ```
 
* **Cek Log Langsung**:
  `journalctl -u StreamHibV2.service -f`

* **Cek Log Recovery**:
  `journalctl -u StreamHibV2.service -f | grep RECOVERY`

* **Cek Log Migration**:
  `journalctl -u StreamHibV2.service -f | grep MIGRATION`
* **Cek Log Domain**:
  `journalctl -u StreamHibV2.service -f | grep DOMAIN`

* **Tes Manual (Tanpa systemd)**:

  ```bash
  venv/bin/python -m flask run --host=0.0.0.0 --port=5000
  
  ```

---

## 🛠 Troubleshooting

### 1. Hetzner Read-Only System

Jika terkena update dan sistem menjadi **Read-Only**:

1. Masuk **Rescue Mode** dan catat password.
2. Jalankan:

   ```bash
   fsck -y /dev/sda1
   reboot
   
   ```

---

### 2. Error `gdown` karena cookies

Jika error setelah disk penuh:

1. Cek kapasitas:

   ```bash
   df -h
   
   ```
2. Hapus cache gdown:

   ```bash
   rm -rf /root/.cache/gdown/
   
   ```

---

### 3. Recovery Tidak Berjalan

Jika sistem recovery tidak berjalan otomatis:

1. Cek status scheduler:
   ```bash
   journalctl -u StreamHibV2.service -f | grep "Scheduler dimulai"
   ```

2. Restart service:
   ```bash
   sudo systemctl restart StreamHibV2.service
   ```

3. Trigger recovery manual melalui API:
   ```bash
   curl -X POST http://localhost:5000/api/recovery/manual \
        -H "Content-Type: application/json" \
        --cookie "session=your_session_cookie"
   ```

---

### 4. Sesi Tidak Terpulihkan

Jika ada sesi yang tidak terpulihkan setelah migrasi:

1. Cek file video ada:
   ```bash
   ls -la /root/StreamHibV2/videos/
   ```

2. Cek data sessions.json:
   ```bash
   cat /root/StreamHibV2/sessions.json | jq '.active_sessions'
   ```

3. Cek service systemd:
   ```bash
   systemctl list-units --type=service | grep stream-
   ```

4. Trigger recovery manual dari web interface atau API

---

### 5. Masalah Domain

Jika domain tidak bisa diakses:

1. Cek DNS propagation:
   ```bash
   nslookup yourdomain.com
   dig yourdomain.com
   ```

2. Cek konfigurasi Nginx:
   ```bash
   nginx -t
   systemctl status nginx
   ```

3. Cek SSL certificate:
   ```bash
   certbot certificates
   ```

4. Cek log Nginx:
   ```bash
   tail -f /var/log/nginx/error.log
   ```

---

### 6. Migrasi Video Lama

Salin folder video dari server lama:

```bash
scp -r root@server_lama:/root/StreamHib/videos /root/StreamHibV2/

```

---

## ✅ Selesai!

Akses aplikasi melalui browser:

**Dengan IP:**
```
http://<IP-Server>:5000
```

**Dengan Domain:**
```
https://yourdomain.com
```

StreamHibV2 siap digunakan untuk kebutuhan live streaming Anda dengan sistem migrasi seamless dan domain terintegrasi!

### 🎯 Keunggulan Migrasi Seamless + Domain:

- ✅ **Zero Downtime**: Live stream tetap berjalan selama migrasi
- ✅ **1-Click Migration**: Transfer semua data dengan Migration Wizard
- ✅ **Real-time Progress**: Monitor progress transfer secara live
- ✅ **Auto Recovery**: Sistem otomatis memulihkan sesi yang terputus
- ✅ **Data Integrity**: Validasi data sebelum recovery
- ✅ **Real-time Monitoring**: Log detail untuk tracking proses
- ✅ **Manual Trigger**: Bisa dipicu manual jika diperlukan
- ✅ **Domain Support**: Akses profesional dengan SSL gratis
- ✅ **Customer Friendly**: Customer tidak perlu tahu perubahan teknis
- ✅ **Error Handling**: Retry dan rollback otomatis jika gagal

---
