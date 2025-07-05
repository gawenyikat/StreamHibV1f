#!/bin/bash

# StreamHib V2 - Installer Script untuk Debian 11
# Tanggal: 31/05/2025
# Fungsi: Instalasi otomatis StreamHib V2 dengan 1 klik

set -e  # Exit on any error

# Warna untuk output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fungsi untuk print dengan warna
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Fungsi untuk mengecek apakah command berhasil
check_command() {
    if [ $? -eq 0 ]; then
        print_success "$1"
    else
        print_error "Gagal: $1"
        exit 1
    fi
}

# Header
echo -e "${GREEN}"
echo "=================================================="
echo "    StreamHib V2 - Auto Installer"
echo "    Tanggal: 31/05/2025"
echo "    Platform: Debian 11 (Ubuntu Compatible)"
echo "    Fitur: Migrasi Seamless + Domain Support"
echo "=================================================="
echo -e "${NC}"

# Cek apakah running sebagai root
if [ "$EUID" -ne 0 ]; then
    print_error "Script ini harus dijalankan sebagai root!"
    print_status "Gunakan: sudo bash install_streamhib.sh"
    exit 1
fi

print_status "Memulai instalasi StreamHib V2..."

# 1. Update sistem
print_status "Mengupdate sistem..."
apt update && apt upgrade -y && apt dist-upgrade -y
check_command "Update sistem"

# 2. Install dependensi dasar
print_status "Menginstall dependensi dasar..."
apt install -y python3 python3-pip python3-venv ffmpeg git curl wget sudo ufw nginx certbot python3-certbot-nginx
check_command "Install dependensi dasar"

# 3. Install gdown
print_status "Menginstall gdown..."
pip3 install gdown
check_command "Install gdown"

# 4. Clone repository
print_status "Mengunduh StreamHib V2..."
cd /root
if [ -d "StreamHibV2" ]; then
    print_warning "Direktori StreamHibV2 sudah ada, menghapus..."
    rm -rf StreamHibV2
fi

git clone https://github.com/emuhib/StreamHibV2.git
check_command "Clone repository"

cd StreamHibV2

# 5. Setup Virtual Environment
print_status "Membuat virtual environment..."
python3 -m venv /root/StreamHibV2/venv
check_command "Buat virtual environment"

# 6. Aktivasi venv dan install dependensi Python
print_status "Menginstall dependensi Python..."
source /root/StreamHibV2/venv/bin/activate
pip install flask flask-socketio flask-cors filelock apscheduler pytz gunicorn eventlet paramiko scp
check_command "Install dependensi Python"

# 7. Buat direktori yang diperlukan
print_status "Membuat direktori yang diperlukan..."
mkdir -p videos static templates
check_command "Buat direktori"

# 8. Set permission untuk sessions.json dan file konfigurasi
print_status "Mengatur permission file..."
touch sessions.json users.json domain_config.json
chmod 777 sessions.json users.json domain_config.json
check_command "Set permission file"

# 9. Buat file favicon.ico dummy jika tidak ada
if [ ! -f "static/favicon.ico" ]; then
    print_status "Membuat favicon dummy..."
    touch static/favicon.ico
fi

# 10. Buat file logo dummy jika tidak ada
if [ ! -f "static/logostreamhib.png" ]; then
    print_status "Membuat logo dummy..."
    touch static/logostreamhib.png
fi

# 11. Setup firewall (untuk VULTR dan provider lain)
print_status "Mengkonfigurasi firewall..."
ufw allow 22/tcp comment 'SSH Access'
ufw allow ssh
ufw allow 5000
ufw allow 80
ufw allow 443
ufw --force enable
check_command "Konfigurasi firewall"

# 12. Buat systemd service
print_status "Membuat systemd service..."
cat > /etc/systemd/system/StreamHibV2.service << 'EOF'
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
EOF
check_command "Buat systemd service"

# 13. Reload systemd dan enable service
print_status "Mengaktifkan service..."
systemctl daemon-reload
systemctl enable StreamHibV2.service
systemctl enable nginx
check_command "Enable service"

# 14. Start service
print_status "Memulai StreamHib V2..."
systemctl start StreamHibV2.service
systemctl start nginx
check_command "Start service"

# 15. Cek status service
sleep 3
if systemctl is-active --quiet StreamHibV2.service; then
    print_success "StreamHib V2 berhasil berjalan!"
else
    print_warning "Service mungkin belum siap, cek status dengan: systemctl status StreamHibV2.service"
fi

# 16. Tampilkan informasi akhir
echo -e "${GREEN}"
echo "=================================================="
echo "    INSTALASI SELESAI!"
echo "=================================================="
echo -e "${NC}"

# Dapatkan IP server
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || hostname -I | awk '{print $1}')

print_success "StreamHib V2 berhasil diinstall!"
echo ""
print_status "Informasi Akses:"
echo "  URL: http://${SERVER_IP}:5000"
echo "  Port: 5000"
echo ""
print_status "Fitur Baru:"
echo "  ✅ Sistem Migrasi Seamless"
echo "  ✅ Recovery Otomatis"
echo "  ✅ Domain Support dengan SSL"
echo "  ✅ Nginx Reverse Proxy"
echo ""
print_status "Setup Domain (Opsional):"
echo "  1. Arahkan domain ke IP: ${SERVER_IP}"
echo "  2. Login ke panel StreamHib"
echo "  3. Masuk menu 'Pengaturan Domain'"
echo "  4. Setup domain dengan SSL otomatis"
echo ""
print_status "Perintah Berguna:"
echo "  Status service: systemctl status StreamHibV2.service"
echo "  Stop service: systemctl stop StreamHibV2.service"
echo "  Start service: systemctl start StreamHibV2.service"
echo "  Restart service: systemctl restart StreamHibV2.service"
echo "  Lihat log: journalctl -u StreamHibV2.service -f"
echo "  Lihat log recovery: journalctl -u StreamHibV2.service -f | grep RECOVERY"
echo "  Lihat log domain: journalctl -u StreamHibV2.service -f | grep DOMAIN"
echo ""
print_status "Direktori instalasi: /root/StreamHibV2"
echo ""

# Cek apakah port 5000 terbuka
print_status "Mengecek koneksi..."
if curl -s --connect-timeout 5 http://localhost:5000 > /dev/null; then
    print_success "Server dapat diakses di http://${SERVER_IP}:5000"
else
    print_warning "Server mungkin masih starting up. Tunggu beberapa detik dan coba akses."
fi

echo ""
print_success "Instalasi StreamHib V2 selesai! Selamat menggunakan!"
echo -e "${YELLOW}Jangan lupa untuk membuat akun pertama di halaman register.${NC}"
echo -e "${BLUE}Untuk setup domain, login ke panel dan masuk menu 'Pengaturan Domain'.${NC}"
echo ""
print_warning "PENTING: SSH tetap dapat diakses di port 22. Jangan lupa ganti password default jika ada."