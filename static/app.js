// Helper umum untuk kelas input dan tombol di modal
const inputFieldClass = "w-full px-3 py-2 bg-element border border-muted rounded-md text-text-primary focus:ring-primary focus:border-primary disabled:opacity-50";
const primaryButtonModalClass = "px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-md transition-colors flex items-center disabled:opacity-50";
const secondaryButtonModalClass = "px-4 py-2 bg-muted hover:bg-element text-text-primary text-sm font-medium rounded-md transition-colors";

const CURRENT_ORIGIN = window.location.origin;
const API_BASE_URL = `${CURRENT_ORIGIN}/api`; // API base URL, sesuaikan jika API ada di domain/port berbeda
const SOCKET_URL = CURRENT_ORIGIN; // URL untuk Socket.IO, sesuaikan jika berbeda

document.addEventListener('alpine:init', () => {
    Alpine.data('appState', () => ({
        // --- State ---
        currentBrowserDateTimeDisplay: '', // Untuk menyimpan string tanggal & waktu yang diformat
        dateTimeInterval: null,            // Untuk menyimpan ID interval update waktu
        currentLang: localStorage.getItem('streamHibLang') || 'id',
        currentView: 'dashboard',
        searchQueryVideos: '',
        searchQueryLive: '',
        searchQueryScheduled: '',
        searchQueryInactive: '',
        sidebarOpen: localStorage.getItem('sidebarPreference') === 'closed' ? false : true,
        isDesktop: window.innerWidth >= 768,
        activeModal: null,
        currentVideoPreview: null, // { id, name, url }
        videos: [], // Array of { id, name, url }
        liveSessions: [], // Array of session objects from backend
        scheduledSessions: [], // Array of schedule objects from backend
        inactiveSessions: [], // Array of inactive session objects from backend
        diskUsage: { status: "Normal", total: 0, used: 0, free: 0, percent_used: 0 },
        toast: { show: false, message: '', type: 'success' }, // type: success, error, info, warning
        confirmation: { 
            show: false, 
            title: '', 
            message: '', 
            onConfirm: null, 
            onCancel: null, 
            confirmButtonText: 'Konfirmasi', 
            confirmButtonClass: 'bg-danger hover:bg-red-600 text-white' 
        },
        loadingStates: { // Untuk indikator loading per bagian
            dashboard: false,
            videos: false,
            liveSessions: false,
            scheduledSessions: false,
            inactiveSessions: false,
            diskUsage: false
        },
        loggedInUser: null, // Akan diisi setelah checkLoginStatus
        socket: null, // Instance Socket.IO
        trialMode: { active: false, message: ''},

        // --- Form Data ---
        forms: {
            downloadVideo: { gdriveUrl: '', progress: 0, status: 'Idle', isDownloading: false },
            renameVideo: { id: null, oldName: '', newNameBase: '' }, // id adalah nama file lama
            manualLive: { sessionName: '', videoFile: '', streamKey: '', platform: 'YouTube' },
            scheduleLive: {
                sessionName: '', videoFile: '', streamKey: '', platform: 'YouTube', recurrenceType: 'one_time',
                onetime: { startTime: '', durationHours: 0 },
                daily: { startTimeOfDay: '', stopTimeOfDay: '' }
            },
            editSchedule: { // Untuk edit jadwal yang sudah ada
                id: null, // ID definisi jadwal
                sessionNameDisplay: '', // Hanya untuk tampilan
                videoFile: '', 
                streamKey: '', 
                platform: 'YouTube',
                recurrenceType: null, // 'one_time' atau 'daily'
                onetime: { startTime: '', durationHours: null },
                daily: { startTimeOfDay: '', stopTimeOfDay: '' }
            },
            editReschedule: { // Untuk sesi tidak aktif
                id: null, // Ini adalah ID sesi asli (nama sesi)
                sessionNameDisplay: '', // Hanya untuk tampilan
                videoFile: '', 
                streamKey: '', 
                platform: 'YouTube',
                recurrenceType: null, // null atau 'one_time' atau 'daily'
                onetime: { startTime: '', durationHours: null }, // durationHours bisa null jika tidak diisi
                daily: { startTimeOfDay: '', stopTimeOfDay: '' }
            }
        },

        // --- Translations Object ---
        translations: {
            appTitle: { id: 'StreamHib', en: 'StreamHib' },
            appTagline: { id: 'emuhib channel presents', en: 'emuhib channel presents' },
            userLabel: { id: 'Pengguna', en: 'User' },
            notLoggedIn: { id: 'Belum Login', en: 'Not Logged In' },
            logoutButton: { id: 'Logout', en: 'Logout' },
            joinTelegramButton: { id: 'Gabung Grup Telegram', en: 'Join Telegram Group' },
            collapseSidebarButton: { id: 'Kecilkan', en: 'Collapse' },
            navDashboard: { id: 'Dashboard', en: 'Dashboard' },
            navVideos: { id: 'Video', en: 'Videos' },
            navLiveSessions: { id: 'Sesi Live', en: 'Live Sessions' },
            navScheduledSessions: { id: 'Terjadwal', en: 'Scheduled' },
            navInactiveSessions: { id: 'Nonaktif', en: 'Inactive' },
            dashboardTitle: { id: 'Dashboard', en: 'Dashboard' },
            liveSessionsStat: { id: 'Sesi Live', en: 'Live Sessions' },
            scheduledOnetimeStat: { id: 'Terjadwal (Sekali Jalan)', en: 'Scheduled (One-time)' },
            scheduledDailyStat: { id: 'Terjadwal (Harian)', en: 'Scheduled (Daily)' },
            inactiveSessionsStat: { id: 'Sesi Tidak Aktif', en: 'Inactive Sessions' },
            videoCountStat: { id: 'Jumlah Video', en: 'Video Count' },
            diskUsageTitle: { id: 'Penggunaan Disk', en: 'Disk Usage' },
            diskStatusLabel: { id: 'Status', en: 'Status' },
            diskTotalLabel: { id: 'Total', en: 'Total' },
            diskUsedLabel: { id: 'Terpakai', en: 'Used' },
            diskFreeLabel: { id: 'Sisa', en: 'Free' },
            diskUsedPercentageSuffix: { id: 'Terpakai', en: 'Used' },
            diskFullAlert: { id: 'Disk penuh!', en: 'Disk is full!' },
            diskAlmostFullAlert: { id: 'Disk hampir penuh!', en: 'Disk is almost full!' },
            normal: { id: 'Normal', en: 'Normal' },
            full: { id: 'Penuh', en: 'Full' },
            almost_full: { id: 'Hampir Penuh', en: 'Almost Full' },
            videosTitle: { id: 'Video', en: 'Videos' },
            downloadVideoButton: { id: 'Unduh Video', en: 'Download Video' },
            deleteAllVideosButton: { id: 'Hapus Semua Video', en: 'Delete All Videos' },
            deleteAllVideosConfirmation: { id: 'Anda yakin ingin menghapus semua video?', en: 'Are you sure you want to delete all videos?' },
            noVideosMessage: { id: 'Tidak ada video. Coba unduh beberapa!', en: 'No videos available. Try downloading some!' },
            loadingVideosMessage: { id: 'Memuat video...', en: 'Loading videos...' },
            previewButton: { id: 'Preview', en: 'Preview' },
            deleteVideoConfirmation: { id: "Anda yakin ingin menghapus video '{videoName}'?", en: "Are you sure you want to delete video '{videoName}'?" },
            liveSessionsTitle: { id: 'Sesi Live (Aktif)', en: 'Live Sessions (Active)' },
            startManualLiveButton: { id: 'Mulai Live Manual', en: 'Start Manual Live' },
            scheduleNewLiveButton: { id: 'Jadwalkan Live Baru', en: 'Schedule New Live' },
            noLiveSessionsMessage: { id: 'Tidak ada sesi live aktif.', en: 'No active live sessions.' },
            loadingLiveSessionsMessage: { id: 'Memuat sesi live...', en: 'Loading live sessions...' },
            manual: { id: 'Manual', en: 'Manual' },
            manual_recovered: { id: 'Manual (Dipulihkan)', en: 'Manual (Recovered)' },
            manual_reactivated: { id: 'Manual (Diaktifkan Ulang)', en: 'Manual (Reactivated)' },
            scheduled: { id: 'Terjadwal (Sekali Jalan)', en: 'Scheduled (One-time)' },
            daily_recurring_instance: { id: 'Harian (Instance)', en: 'Daily (Instance)' },
            unknown: { id: 'Tidak Diketahui', en: 'Unknown' },
            manual_from_schedule_error: { id: 'Manual (Error Jadwal)', en: 'Manual (Schedule Error)'},
            manual_force_stop: { id: 'Manual (Stop Paksa)', en: 'Manual (Forced Stop)'},
            videoLabel: { id: 'Video', en: 'Video' },
            platformLabel: { id: 'Platform', en: 'Platform' },
            startTimeLabel: { id: 'Waktu Mulai', en: 'Start Time' },
            autoStopLabel: { id: 'Auto-Stop', en: 'Auto-Stop' },
            manualStopLabel: { id: 'Stop Manual', en: 'Manual Stop' },
            stopSessionButton: { id: 'Hentikan Sesi', en: 'Stop Session' },
            stopSessionConfirmation: { id: "Anda yakin ingin menghentikan sesi '{sessionName}'?", en: "Are you sure you want to stop session '{sessionName}'?" },
            scheduledSessionsTitle: { id: 'Sesi Terjadwal', en: 'Scheduled Sessions' },
            noScheduledSessionsMessage: { id: 'Tidak ada sesi terjadwal.', en: 'No scheduled sessions.' },
            loadingScheduledSessionsMessage: { id:  'Memuat sesi terjadwal...', en: 'Loading scheduled sessions...' },
            one_time: { id: 'Sekali Jalan', en: 'One-time' },
            daily: { id: 'Harian', en: 'Daily' },
            scheduleLabel: { id: 'Jadwal', en: 'Schedule' },
            endsLabel: { id: 'Berakhir', en: 'Ends' },
            editScheduleButton: { id: 'Edit', en: 'Edit' },
            cancelScheduleButton: { id: 'Batalkan Jadwal', en: 'Cancel Schedule' },
            cancelScheduleConfirmation: { id: "Anda yakin ingin membatalkan jadwal '{sessionName}'?", en: "Are you sure you want to cancel schedule '{sessionName}'?" },
            inactiveSessionsTitle: { id: 'Sesi Tidak Aktif', en: 'Inactive Sessions' },
            deleteAllInactiveSessionsButton: { id: 'Hapus Semua Sesi Nonaktif', en: 'Delete All Inactive Sessions' },
            deleteAllInactiveSessionsConfirmation: { id: 'Anda yakin ingin menghapus semua sesi tidak aktif?', en: 'Are you sure you want to delete all inactive sessions?' },
            noInactiveSessionsMessage: { id: 'Tidak ada sesi tidak aktif.', en: 'No inactive sessions.' },
            loadingInactiveSessionsMessage: { id: 'Memuat sesi tidak aktif...', en: 'Loading inactive sessions...' },
            lastStopTimeLabel: { id: 'Waktu Berhenti Terakhir', en: 'Last Stop Time' },
            optionsButton: { id: 'Opsi', en: 'Options' },
            deleteInactiveSessionConfirmation: { id: "Anda yakin ingin menghapus sesi tidak aktif '{sessionName}'?", en: "Are you sure you want to delete inactive session '{sessionName}'?" },
            reactivateNowButton: { id: 'Live Sekarang', en: 'Live Now' },
            editRescheduleButton: { id: 'Jadwalkan Ulang', en: 'Reschedule' },
            modalDownloadVideoTitle: { id: 'Unduh Video dari GDrive', en: 'Download Video from GDrive' },
            gdriveUrlLabel: { id: 'URL/ID GDrive', en: 'GDrive URL/ID' },
            gdriveUrlPlaceholder: { id: 'Masukkan URL atau ID Google Drive', en: 'Enter Google Drive URL or ID' },
            progressLabel: { id: 'Progres', en: 'Progress' },
            downloadingButton: { id: 'Mengunduh...', en: 'Downloading...' },
            downloadButton: { id: 'Unduh', en: 'Download' },
            modalPreviewVideoTitle: { id: 'Preview', en: 'Preview' },
            videoPlayerPlaceholder: { id: 'HTML5 Video Player Placeholder (Backend endpoint /videos/<filename> diperlukan)', en: 'HTML5 Video Player Placeholder (Backend endpoint /videos/<filename> needed)' },
            videoPreviewError: { id: 'Gagal memuat preview video.', en: 'Failed to load video preview.'},
            closeButton: { id: 'Tutup', en: 'Close' },
            modalRenameVideoTitle: { id: 'Ubah Nama Video', en: 'Rename Video' },
            newVideoNameLabel: { id: 'Nama Video Baru (tanpa ekstensi)', en: 'New Video Name (without extension)' },
            newVideoNamePlaceholder: { id: 'Masukkan nama video baru', en: 'Enter new video name' },
            renameButton: { id: 'Ubah Nama', en: 'Rename' },
            modalStartManualLiveTitle: { id: 'Mulai Live Manual', en: 'Start Manual Live' },
            sessionNameLabel: { id: 'Nama Sesi', en: 'Session Name' },
            sessionNamePlaceholder: { id: 'Contoh: Live Gaming Malam Ini', en: 'E.g.: Evening Gaming Live' },
            videoFileLabel: { id: 'File Video', en: 'Video File' },
            selectVideoPlaceholder: { id: 'Pilih video', en: 'Select video' },
            streamKeyLabel: { id: 'Stream Key', en: 'Stream Key' },
            streamKeyPlaceholder: { id: 'xxxx-xxxx-xxxx-xxxx', en: 'xxxx-xxxx-xxxx-xxxx' },
            startLiveButton: { id: 'Mulai Live', en: 'Start Live' },
            modalScheduleNewLiveTitle: { id: 'Jadwalkan Live Baru', en: 'Schedule New Live' },
            sessionNamePlaceholderScheduled: { id: 'Contoh: Diskusi Pagi', en: 'E.g.: Morning Discussion' },
            scheduleTypeLabel: { id: 'Tipe Jadwal', en: 'Schedule Type' },
            oneTimeLabel: { id: 'Sekali Jalan', en: 'One-time' },
            dailyLabel: { id: 'Harian', en: 'Daily' },
            startDateTimeLabel: { id: 'Tanggal & Waktu Mulai', en: 'Start Date & Time' },
            durationHoursLabel: { id: 'Durasi (jam, 0 untuk stop manual)', en: 'Duration (hours, 0 for manual stop)' },
            dailyStartTimeLabel: { id: 'Waktu Mulai Harian', en: 'Daily Start Time' },
            dailyStopTimeLabel: { id: 'Waktu Berhenti Harian', en: 'Daily Stop Time' },
            scheduleLiveButton: { id: 'Jadwalkan Live', en: 'Schedule Live' },
            modalEditRescheduleTitle: { id: 'Edit / Jadwalkan Ulang Sesi', en: 'Edit / Reschedule Session' },
            readOnlyLabel: { id: 'read-only', en: 'read-only' },
            reschedulingOptionsLabel: { id: 'Opsi Penjadwalan Ulang', en: 'Rescheduling Options' },
            reschedulingInstruction: { id: 'Kosongkan field waktu/durasi jika hanya ingin mengubah detail sesi di atas tanpa menjadwalkan ulang.', en: 'Leave time/duration fields empty if you only want to change session details without rescheduling.' },
            durationHoursLabelOneTime: { id: 'Durasi (jam)', en: 'Duration (hours)' },
            durationPlaceholder: { id: 'Kosongkan jika tidak dijadwalkan ulang', en: 'Leave empty if not rescheduling' },
            saveRescheduleButton: { id: 'Simpan Perubahan / Jadwalkan Ulang', en: 'Save Changes / Reschedule' },
            saveScheduleButton: { id: 'Simpan Perubahan', en: 'Save Changes' },
            cancelButton: { id: 'Batal', en: 'Cancel' },
            confirmButton: { id: 'Konfirmasi', en: 'Confirm' },
            confirmActionTitle: { id: 'Konfirmasi Tindakan', en: 'Confirm Action' },
            languageChangedTo: { id: 'Bahasa diubah ke {langName}.', en: 'Language changed to {langName}.'},
            idleStatus: { id: 'Idle', en: 'Idle'},
            downloadStarting: { id: 'Memulai unduhan...', en: 'Starting download...'},
            downloadComplete: { id: 'Unduhan selesai!', en: 'Download complete!'},
            videoDownloadScheduled: { id: 'Video berhasil diunduh/dijadwalkan untuk diunduh.', en: 'Video successfully downloaded/scheduled for download.'},
            videoRenamedSuccess: { id: 'Video berhasil diubah nama.', en: 'Video renamed successfully.'},
            videoDeletedSuccess: { id: 'Video berhasil dihapus.', en: 'Video deleted successfully.'},
            allVideosDeletedSuccess: { id: 'Semua video berhasil dihapus.', en: 'All videos deleted successfully.'},
            manualLiveStartedSuccess: { id: 'Sesi live manual berhasil dimulai.', en: 'Manual live session started successfully.'},
            sessionScheduledSuccess: { id: 'Sesi berhasil dijadwalkan.', en: 'Session scheduled successfully.'},
            scheduleUpdatedSuccess: { id: 'Jadwal berhasil diperbarui.', en: 'Schedule updated successfully.'},
            liveSessionStoppedSuccess: { id: 'Sesi live berhasil dihentikan.', en: 'Live session stopped successfully.'},
            scheduleCancelledSuccess: { id: 'Jadwal berhasil dibatalkan.', en: 'Schedule cancelled successfully.'},
            sessionReactivatedSuccess: { id: 'Sesi berhasil diaktifkan kembali.', en: 'Session reactivated successfully.'},
            sessionRescheduledSuccess: { id: 'Sesi berhasil dijadwalkan ulang.', en: 'Session rescheduled successfully.'},
            sessionDetailsUpdatedSuccess: { id: 'Detail sesi berhasil diperbarui.', en: 'Session details updated successfully.'},
            inactiveSessionDeletedSuccess: { id: 'Sesi tidak aktif berhasil dihapus.', en: 'Inactive session deleted successfully.'},
            networkError: { id: 'Terjadi kesalahan jaringan.', en: 'A network error occurred.'},
            invalidDate: { id: 'Tanggal Tidak Valid', en: 'Invalid Date'},
            connectedToSocket: { id: 'Terhubung ke server StreamHib via Socket.IO!', en: 'Connected to StreamHib server via Socket.IO!' },
            disconnectedFromSocket: { id: 'Koneksi Socket.IO terputus.', en: 'Socket.IO connection disconnected.' },
            socketConnectionError: { id: 'Kesalahan koneksi Socket.IO: {error}', en: 'Socket.IO connection error: {error}' },
            videosUpdated: { id: 'Daftar video diperbarui.', en: 'Video list updated.' },
            liveSessionsUpdated: { id: 'Sesi live diperbarui.', en: 'Live sessions updated.' },
            scheduledSessionsUpdated: { id: 'Sesi terjadwal diperbarui.', en: 'Scheduled sessions updated.' },
            inactiveSessionsUpdated: { id: 'Sesi tidak aktif diperbarui.', en: 'Inactive sessions updated.' },
            sessionEndedGeneric: { id: "Sesi Anda telah berakhir. Harap login kembali.", en: "Your session has ended. Please log in again." },
            cannotVerifySession: { id: "Tidak dapat memverifikasi sesi. Mengarahkan ke login.", en: "Cannot verify session. Redirecting to login." },
            gdriveUrlRequired: { id: "URL/ID GDrive diperlukan.", en: "GDrive URL/ID is required." },
            newNameRequired: { id: "Nama baru tidak boleh kosong.", en: "New name cannot be empty." },
            allFieldsRequired: { id: "Semua field wajib diisi.", en: "All fields are required." },
            scheduleAllFieldsRequired: { id: "Nama sesi, file video, dan stream key wajib diisi.", en: "Session name, video file, and stream key are required." },
            scheduleOnetimeStartTimeRequired: { id: "Tanggal & Waktu Mulai wajib untuk jadwal sekali jalan.", en: "Start Date & Time is required for one-time schedule." },
            scheduleDailyTimeRequired: { id: "Waktu Mulai dan Berhenti Harian wajib untuk jadwal harian.", en: "Daily Start and Stop Time are required for daily schedule." },
            featureNotImplemented: { id: "Fitur '{featureName}' belum diimplementasikan di backend.", en: "Feature '{featureName}' is not yet implemented in the backend." },
            searchPlaceholderShort: { id: 'Cari...', en: 'Search...' },
            durationLabel: { id: "Durasi Live", en: "Live Duration" },
            durationNotAvailable: { id: 'Durasi T/A', en: 'Duration N/A' }, // T/A = Tidak Ada
            durationInvalidData: { id: 'Data Durasi Invalid', en: 'Invalid Duration Data' },
            hoursSuffixShort: { id: 'Jam', en: 'hr' }, // Atau 'Jam' jika ingin tetap
            minutesSuffixShort: { id: 'Menit', en: 'min' }, // Atau 'Menit'
            lessThanAMinute: { id: 'Kurang dari 1 menit', en: 'Less than 1 min' },
            durationError: { id: 'Gagal Hitung Durasi', en: 'Duration Error' },
        },

        // --- Computed Properties (Getter) ---
        get translatedNavigation() {
            return this.rawNavigation.map(item => ({
                ...item,
                name: this.t(item.nameKey) 
            }));
        },
        get translatedDashboardStats() {
             return [
                { id: 'live', nameKey: 'liveSessionsStat', value: this.liveSessions.length, icon: this.rawNavigation.find(n=>n.id==='live-sessions').icon },
                { id: 'onetime', nameKey: 'scheduledOnetimeStat', value: this.scheduledSessions.filter(s => s.recurrence_type === 'one_time' || s.recurrence_type === 'Sekali Jalan').length, icon: this.rawNavigation.find(n=>n.id==='scheduled-sessions').icon },
                { id: 'daily', nameKey: 'scheduledDailyStat', value: this.scheduledSessions.filter(s => s.recurrence_type === 'daily' || s.recurrence_type === 'Harian').length, icon: this.rawNavigation.find(n=>n.id==='scheduled-sessions').icon },
                { id: 'inactive', nameKey: 'inactiveSessionsStat', value: this.inactiveSessions.length, icon: this.rawNavigation.find(n=>n.id==='inactive-sessions').icon },
                { id: 'videos', nameKey: 'videoCountStat', value: this.videos.length, icon: this.rawNavigation.find(n=>n.id==='videos').icon },
            ].map(stat => ({...stat, name: this.t(stat.nameKey) }));
        },
        
        get filteredVideos() {
            if (!this.searchQueryVideos.trim()) return this.videos; // Kembalikan semua jika query kosong
            const query = this.searchQueryVideos.toLowerCase().trim();
            return this.videos.filter(video =>
                video.name.toLowerCase().includes(query)
            );
        },
        get filteredLiveSessions() {
            if (!this.searchQueryLive.trim()) return this.liveSessions;
            const query = this.searchQueryLive.toLowerCase().trim();
            return this.liveSessions.filter(session =>
                (session.name && session.name.toLowerCase().includes(query)) ||
                (session.video_name && session.video_name.toLowerCase().includes(query)) ||
                (session.stream_key && session.stream_key.toLowerCase().includes(query)) || // Cari berdasarkan stream key
                (session.platform && session.platform.toLowerCase().includes(query))
            );
        },
        get filteredScheduledSessions() {
            if (!this.searchQueryScheduled.trim()) return this.scheduledSessions;
            const query = this.searchQueryScheduled.toLowerCase().trim();
            return this.scheduledSessions.filter(session =>
                (session.session_name_original && session.session_name_original.toLowerCase().includes(query)) ||
                (session.video_file && session.video_file.toLowerCase().includes(query)) ||
                (session.stream_key && session.stream_key.toLowerCase().includes(query)) || // Cari berdasarkan stream key
                (session.platform && session.platform.toLowerCase().includes(query))
            );
        },
        get filteredInactiveSessions() {
            if (!this.searchQueryInactive.trim()) return this.inactiveSessions;
            const query = this.searchQueryInactive.toLowerCase().trim();
            return this.inactiveSessions.filter(session =>
                (session.id && session.id.toLowerCase().includes(query)) || // session.id adalah nama sesi untuk nonaktif
                (session.video_name && session.video_name.toLowerCase().includes(query)) ||
                (session.stream_key && session.stream_key.toLowerCase().includes(query)) || // Cari berdasarkan stream key
                (session.platform && session.platform.toLowerCase().includes(query))
            );
        },

        // --- Methods ---
        
        updateBrowserDateTime() {
            const now = new Date(); // 'new Date()' akan otomatis menggunakan zona waktu lokal browser

            const day = String(now.getDate()).padStart(2, '0');
            // Nama bulan disesuaikan dengan bahasa yang dipilih
            const monthNamesId = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
            const monthNamesEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const month = this.currentLang === 'id' ? monthNamesId[now.getMonth()] : monthNamesEn[now.getMonth()];
            const year = now.getFullYear();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');

            // Anda bisa memilih format yang paling sesuai. Contoh:
            if (this.currentLang === 'id') {
                // Format untuk Bahasa Indonesia: DD Mon TAHUN, HH:mm:ss
                this.currentBrowserDateTimeDisplay = `${day} ${month} ${year}, ${hours}:${minutes}:${seconds}`;
            } else { 
                // Format untuk Bahasa Inggris (contoh): Mon DD, TAHUN, HH:mm:ss
                this.currentBrowserDateTimeDisplay = `${month} ${day}, ${year}, ${hours}:${minutes}:${seconds}`;
            }
        },
        
        t(key, params = {}) {
            const lang = this.currentLang;
            let text = (this.translations[key] && this.translations[key][lang]) ? this.translations[key][lang] : key;
            for (const pKey in params) {
                text = text.replace(new RegExp(`{${pKey}}`, 'g'), params[pKey]);
            }
            return text;
        },
        setLang(lang) {
            this.currentLang = lang;
            localStorage.setItem('streamHibLang', lang);
            document.documentElement.lang = lang;
            this.showToast(this.t('languageChangedTo', { langName: lang === 'id' ? 'Bahasa Indonesia' : 'English' }), 'info');
        },
        async init() {
            this.updateBrowserDateTime(); // Panggil sekali saat inisialisasi
            if (this.dateTimeInterval) { // Hapus interval lama jika ada (untuk kebersihan kode)
            clearInterval(this.dateTimeInterval);
            }
            this.dateTimeInterval = setInterval(() => {
            this.updateBrowserDateTime();
            }, 1000); // Update setiap 1000 milidetik = 1 detik
       
            console.log("[Alpine] init started.");
            this.handleResize();
            window.addEventListener('resize', () => this.handleResize());
            document.documentElement.lang = this.currentLang;

            console.log("[Alpine] Memulai pengecekan status login...");
            await this.checkLoginStatus(); // Tunggu hasil checkLoginStatus
            console.log("[Alpine] Status loggedInUser setelah checkLoginStatus:", this.loggedInUser);

            if (this.loggedInUser) {
                console.log("[Alpine] Pengguna login sebagai:", this.loggedInUser, ". Melanjutkan inisialisasi...");
                this.setupSocketIO();
                this.fetchInitialData(); // Panggil setelah socket setup
            } else {
                console.warn("[Alpine] Pengguna tidak login, menghentikan inisialisasi Socket.IO dan data awal.");
                 // Redirect sudah ditangani di checkLoginStatus jika perlu
            }

            const hash = window.location.hash.substring(1);
            const navItem = this.rawNavigation.find(n => n.id === hash);
            this.currentView = (hash && navItem) ? hash : 'dashboard';
            this.setActiveNav(this.currentView);

            this.$watch('currentView', (newView) => {
                this.setActiveNav(newView);
                window.location.hash = newView;
                window.scrollTo(0,0);
                // Fetch data spesifik jika view berubah dan data belum ada (opsional, tergantung strategi)
                if (newView === 'videos' && this.videos.length === 0) this.fetchVideos();
                if (newView === 'dashboard') this.fetchDiskUsage(); // Selalu fetch disk usage saat ke dashboard
            });
             console.log("[Alpine] init selesai.");
        },
        handleResize() { this.isDesktop = window.innerWidth >= 768; },
        setActiveNav(viewId) { this.currentView = viewId; },
        
        async checkLoginStatus() {
            console.log("[Alpine] checkLoginStatus: Memanggil /api/check-session");
            try {
                // Menggunakan fetch standar untuk panggilan awal ini agar tidak ada dependensi ke this.callApi yang mungkin belum sepenuhnya siap
                const response = await fetch(`${API_BASE_URL}/check-session`, { credentials: 'include' });
                console.log("[Alpine] checkLoginStatus: Respon status:", response.status);

                if (!response.ok) {
                    console.warn("[Alpine] checkLoginStatus: Respon tidak OK. Status:", response.status);
                    if (response.status === 401 || response.redirected) {
                        console.log("[Alpine] checkLoginStatus: Tidak login (401 atau redirect). Mengarahkan ke /login.");
                        this.loggedInUser = null;
                        if (!window.location.pathname.endsWith('/login') && !window.location.pathname.endsWith('/register')) {
                            window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname + window.location.hash);
                        }
                        return; // Hentikan eksekusi lebih lanjut jika redirect
                    }
                    // Jika error lain, coba baca teksnya
                    const errorText = await response.text();
                    console.error("[Alpine] checkLoginStatus: Error response text:", errorText);
                    this.loggedInUser = null; // Anggap tidak login jika ada error lain
                    return;
                }

                const data = await response.json();
                console.log("[Alpine] checkLoginStatus: Respon data:", data);
                if (data && data.logged_in === true) {
                    this.loggedInUser = data.user;
                    console.log("[Alpine] checkLoginStatus: Login berhasil, pengguna:", this.loggedInUser);
                } else {
                    this.loggedInUser = null;
                    console.warn("[Alpine] checkLoginStatus: Tidak login atau data sesi tidak valid.", data);
                    if (!window.location.pathname.endsWith('/login') && !window.location.pathname.endsWith('/register')) {
                       window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname + window.location.hash);
                    }
                }
            } catch (error) { // Error jaringan atau JSON parsing
                this.loggedInUser = null;
                console.error("[Alpine] checkLoginStatus: Error (catch block):", error);
                this.showToast(this.t('cannotVerifySession'), "error");
                if (!window.location.pathname.endsWith('/login') && !window.location.pathname.endsWith('/register')) {
                    // setTimeout(() => { window.location.href = '/login'; }, 2000); // Beri waktu toast tampil
                    console.warn("[Alpine] checkLoginStatus: Akan redirect ke /login karena error, tapi mungkin sudah dihandle.");
                }
            }
        },

        openModal(modalId, data = null) {
            console.log(`[Alpine] openModal: ${modalId}`, data);
            this.activeModal = modalId;
            // Reset form atau prefill data berdasarkan modalId
            if (modalId === 'downloadVideoModal') {
                this.forms.downloadVideo.gdriveUrl = '';
                this.forms.downloadVideo.progress = 0;
                this.forms.downloadVideo.status = this.t('idleStatus');
                this.forms.downloadVideo.isDownloading = false;
            } else if (modalId === 'renameVideoModal' && data) {
                this.forms.renameVideo.id = data.id; // id adalah nama file lama
                this.forms.renameVideo.oldName = data.name;
                this.forms.renameVideo.newNameBase = data.name.substring(0, data.name.lastIndexOf('.')) || data.name;
            } else if (modalId === 'startManualLiveModal') {
                this.forms.manualLive = { sessionName: '', videoFile: '', streamKey: '', platform: 'YouTube' };
            } else if (modalId === 'scheduleNewLiveModal') {
                this.forms.scheduleLive = {
                    sessionName: '', videoFile: '', streamKey: '', platform: 'YouTube', recurrenceType: 'one_time',
                    onetime: { startTime: this.formatToDateTimeLocal(new Date(Date.now() + 3600000)), durationHours: 1 }, // Default 1 jam dari sekarang
                    daily: { startTimeOfDay: '09:00', stopTimeOfDay: '10:00' }
                };
            } else if (modalId === 'editScheduleModal' && data) { // data adalah objek jadwal
                this.forms.editSchedule.id = data.id;
                this.forms.editSchedule.sessionNameDisplay = data.session_name_original;
                this.forms.editSchedule.videoFile = data.video_file || '';
                this.forms.editSchedule.streamKey = data.stream_key || '';
                this.forms.editSchedule.platform = data.platform || 'YouTube';
                this.forms.editSchedule.recurrenceType = data.recurrence_type;
                
                if (data.recurrence_type === 'one_time') {
                    this.forms.editSchedule.onetime.startTime = data.start_time_iso ? this.formatToDateTimeLocal(data.start_time_iso) : '';
                    this.forms.editSchedule.onetime.durationHours = data.duration_minutes ? parseFloat((data.duration_minutes / 60).toFixed(1)) : 0;
                } else if (data.recurrence_type === 'daily') {
                    this.forms.editSchedule.daily.startTimeOfDay = data.start_time_of_day || '';
                    this.forms.editSchedule.daily.stopTimeOfDay = data.stop_time_of_day || '';
                }
            } else if (modalId === 'editRescheduleModal' && data) { // data adalah objek sesi tidak aktif
                this.forms.editReschedule.id = data.id;
                this.forms.editReschedule.sessionNameDisplay = data.id;
                this.forms.editReschedule.videoFile = data.video_name || '';
                this.forms.editReschedule.streamKey = data.stream_key || '';
                this.forms.editReschedule.platform = data.platform || 'YouTube';
                this.forms.editReschedule.recurrenceType = null; // Default tidak ada yang dipilih untuk reschedule
                this.forms.editReschedule.onetime = { startTime: '', durationHours: null };
                this.forms.editReschedule.daily = { startTimeOfDay: '', stopTimeOfDay: '' };
                // Pre-fill jika ada data original yang relevan (dari app.py, start_time_original & duration_minutes_original)
                if (data.start_time_original) {
                    this.forms.editReschedule.onetime.startTime = this.formatToDateTimeLocal(data.start_time_original);
                }
                if (data.duration_minutes_original !== undefined && data.duration_minutes_original !== null) {
                    this.forms.editReschedule.onetime.durationHours = parseFloat((data.duration_minutes_original / 60).toFixed(1));
                }
            } else if (modalId === 'previewVideoModal' && data) {
                this.currentVideoPreview = data; // data = { id, name, url }
            }
             this.$nextTick(() => { // Pastikan modal ada di DOM sebelum fokus
                const firstInput = document.querySelector(`#${modalId} input, #${modalId} select, #${modalId} textarea`);
                if (firstInput) firstInput.focus();
            });
        },
        closeActiveModal() { 
            if (this.activeModal === 'previewVideoModal' && this.currentVideoPreview) {
                const videoPlayer = this.$refs.videoPlayerRef; // Anda perlu menambahkan x-ref="videoPlayerRef" ke tag video
                if (videoPlayer) { videoPlayer.pause(); videoPlayer.src = ''; }
            }
            this.activeModal = null; 
            this.currentVideoPreview = null;
        },
        showToast(message, type = 'success', duration = 3000) {
            this.toast = { show: true, message, type };
            setTimeout(() => { this.toast.show = false; }, duration);
        },
        confirmAction(message, onConfirmCallback, title = null, confirmButtonText = null, confirmButtonClass = 'bg-danger hover:bg-red-600 text-white') {
            this.confirmation = {
                show: true,
                title: title || this.t('confirmActionTitle'),
                message: message,
                onConfirm: onConfirmCallback.bind(this), // Ikat 'this' dari appState ke callback
                onCancel: () => { this.showToast(this.t('toastActionCancelled'), 'info'); },
                confirmButtonText: confirmButtonText || this.t('confirmButton'),
                confirmButtonClass: confirmButtonClass
            };
        },
        async callApi(endpoint, method = 'GET', body = null) {
            console.log(`[Alpine] callApi: ${method} ${API_BASE_URL}${endpoint}`, body ? `Body: ${JSON.stringify(body).substring(0,100)}...` : '');
            const url = `${API_BASE_URL}${endpoint}`;
            const options = { method, headers: {}, credentials: 'include' };
            if (body) { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
            
            try {
                const response = await fetch(url, options);
                console.log(`[Alpine] callApi Response: ${url} Status: ${response.status}`);
                if (response.status === 401 && !window.location.pathname.endsWith('/login') && !window.location.pathname.endsWith('/register')) {
                    this.showToast(this.t('sessionEndedGeneric'), "error");
                    setTimeout(() => { window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname + window.location.hash); }, 2000);
                    throw new Error("Unauthorized"); // Hentikan eksekusi lebih lanjut
                }
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const data = await response.json();
                    console.log(`[Alpine] callApi JSON Data: ${url}`, data);
                    if (!response.ok) throw new Error(data.message || `Error ${response.status}`);
                    return data;
                } else {
                    const textData = await response.text();
                    if (!response.ok) {
                        console.error("[Alpine] API Error (Non-JSON):", response.status, textData);
                        throw new Error(textData || `Error ${response.status}`);
                    }
                    console.warn("[Alpine] callApi: Non-JSON OK response for endpoint", endpoint, "Status:", response.status, "Body:", textData.substring(0,200)+"...");
                    return { status: 'success', message: 'Operasi berhasil (respons bukan JSON).', raw: textData };
                }
            } catch (error) {
                console.error(`[Alpine] callApi: Error untuk ${endpoint}:`, error);
                if (error.message !== "Unauthorized") { this.showToast(error.message || this.t('networkError'), 'error');}
                throw error; // Lempar error agar bisa ditangani oleh pemanggil
            }
        },
        async fetchInitialData() {
            console.log("[Alpine] fetchInitialData: Memulai...");
            this.loadingStates = { dashboard: true, videos: true, liveSessions: true, scheduledSessions: true, inactiveSessions: true, diskUsage: true };
            try {
                await Promise.all([
                    this.fetchDiskUsage(),
                    this.fetchVideos(),
                    this.fetchLiveSessions(),
                    this.fetchScheduledSessions(),
                    this.fetchInactiveSessions()
                ]);
                console.log("[Alpine] fetchInitialData: Semua data awal berhasil diambil.");
            } catch (error) {
                console.error("[Alpine] fetchInitialData: Gagal mengambil semua data awal ->", error);
                this.showToast(this.t('errorFetchingInitialData', { error: error.message }), 'error');
            } finally {
                this.loadingStates = { dashboard: false, videos: false, liveSessions: false, scheduledSessions: false, inactiveSessions: false, diskUsage: false };
            }
        },
        async fetchVideos() {
            this.loadingStates.videos = true;
            try {
                const videoFilenames = await this.callApi('/videos'); // Endpoint mengembalikan array string nama file
                this.videos = videoFilenames.map(filename => ({ id: filename, name: filename, url: `${CURRENT_ORIGIN}/videos/${encodeURIComponent(filename)}` }));
            } catch (error) { this.videos = []; console.error("Gagal mengambil video:", error); } 
            finally { this.loadingStates.videos = false; }
        },
        async fetchDiskUsage() {
            this.loadingStates.diskUsage = true;
            try {
                const data = await this.callApi('/disk-usage');
                this.diskUsage = data; // Backend sudah mengembalikan format yang benar
            } catch (error) { this.diskUsage = { status: "Error", total: 0, used: 0, free: 0, percent_used: 0 }; console.error("Gagal mengambil info disk:", error);}
            finally { this.loadingStates.diskUsage = false; }
        },
        async fetchLiveSessions() {
            this.loadingStates.liveSessions = true;
            try { this.liveSessions = await this.callApi('/sessions'); } // Endpoint mengembalikan array sesi aktif
            catch (error) { this.liveSessions = []; console.error("Gagal mengambil sesi live:", error); }
            finally { this.loadingStates.liveSessions = false; }
        },
        async fetchScheduledSessions() {
            this.loadingStates.scheduledSessions = true;
            try { this.scheduledSessions = await this.callApi('/schedule-list'); } // Endpoint mengembalikan array jadwal
            catch (error) { this.scheduledSessions = []; console.error("Gagal mengambil sesi terjadwal:", error); }
            finally { this.loadingStates.scheduledSessions = false; }
        },
        async fetchInactiveSessions() {
            console.log("[Alpine] fetchInactiveSessions: Memulai...");
            this.loadingStates.inactiveSessions = true;
            try { 
                const data = await this.callApi('/inactive-sessions');
                this.inactiveSessions = data.inactive_sessions || [];
                console.log("[Alpine] fetchInactiveSessions: Sesi tidak aktif dimuat:", this.inactiveSessions);
            } catch (error) { 
                this.inactiveSessions = []; 
                console.error("Gagal mengambil sesi tidak aktif:", error); 
            } finally { 
                this.loadingStates.inactiveSessions = false; 
                console.log("[Alpine] fetchInactiveSessions: Loading state disetel ke false. Jumlah sesi:", this.inactiveSessions.length);
            }
        },
        async handleDownloadVideo() {
            if (!this.forms.downloadVideo.gdriveUrl) { this.showToast(this.t('gdriveUrlRequired'), 'error'); return; }
            this.forms.downloadVideo.isDownloading = true;
            this.forms.downloadVideo.status = this.t('downloadStarting');
            this.forms.downloadVideo.progress = 0;
            let progressInterval = setInterval(() => { if (this.forms.downloadVideo.progress < 90) this.forms.downloadVideo.progress += 5; }, 200);
            try {
                const result = await this.callApi('/download', 'POST', { file_id: this.forms.downloadVideo.gdriveUrl });
                this.showToast(result.message || this.t('videoDownloadScheduled'), 'success');
                this.forms.downloadVideo.status = this.t('downloadComplete');
                this.forms.downloadVideo.progress = 100;
                this.forms.downloadVideo.gdriveUrl = ''; // Reset field
            } catch (error) {
                this.forms.downloadVideo.status = error.message || this.t('downloadFailedGeneric');
            } finally {
                clearInterval(progressInterval);
                setTimeout(() => { this.forms.downloadVideo.isDownloading = false; this.forms.downloadVideo.progress = 0;}, 2000);
            }
        },
        async handleRenameVideo() {
            if (!this.forms.renameVideo.newNameBase.trim()) { this.showToast(this.t('newNameRequired'), 'error'); return; }
            try {
                const result = await this.callApi('/videos/rename', 'POST', { old_name: this.forms.renameVideo.oldName, new_name: this.forms.renameVideo.newNameBase.trim() });
                this.showToast(result.message || this.t('videoRenamedSuccess'), 'success');
                this.closeActiveModal();
            } catch (error) { /* Toast sudah ditangani oleh callApi */ }
        },
        async deleteVideo(videoFilename) {
            try {
                const result = await this.callApi('/videos/delete', 'POST', { file_name: videoFilename });
                this.showToast(result.message || this.t('videoDeletedSuccess'), 'success');
            } catch (error) { /* Toast sudah ditangani oleh callApi */ }
        },
        async deleteAllVideos() {
            try {
                const result = await this.callApi('/videos/delete-all', 'POST');
                this.showToast(result.message || this.t('allVideosDeletedSuccess'), 'success');
            } catch (error) { /* Toast sudah ditangani oleh callApi */ }
        },
        async handleStartManualLive() {
            if (!this.forms.manualLive.sessionName || !this.forms.manualLive.videoFile || !this.forms.manualLive.streamKey) {
                this.showToast(this.t('allFieldsRequired'), 'error'); return;
            }
            try {
                const result = await this.callApi('/start', 'POST', {
                    session_name: this.forms.manualLive.sessionName,
                    video_file: this.forms.manualLive.videoFile,
                    stream_key: this.forms.manualLive.streamKey,
                    platform: this.forms.manualLive.platform
                });
                this.showToast(result.message || this.t('manualLiveStartedSuccess'), 'success');
                this.closeActiveModal();
            } catch (error) { /* Toast sudah ditangani oleh callApi */ }
        },
        async handleScheduleNewLive() {
            const form = this.forms.scheduleLive;
            if (!form.sessionName || !form.videoFile || !form.streamKey) {
                this.showToast(this.t('scheduleAllFieldsRequired'), 'error'); return;
            }
            let payload = {
                session_name_original: form.sessionName,
                video_file: form.videoFile,
                stream_key: form.streamKey,
                platform: form.platform,
                recurrence_type: form.recurrenceType
            };
            if (form.recurrenceType === 'one_time') {
                if (!form.onetime.startTime) { this.showToast(this.t('scheduleOnetimeStartTimeRequired'), 'error'); return; }
                payload.start_time = form.onetime.startTime;
                payload.duration = form.onetime.durationHours; // Backend akan handle jika 0
            } else if (form.recurrenceType === 'daily') {
                if (!form.daily.startTimeOfDay || !form.daily.stopTimeOfDay) { this.showToast(this.t('scheduleDailyTimeRequired'), 'error'); return; }
                payload.start_time_of_day = form.daily.startTimeOfDay;
                payload.stop_time_of_day = form.daily.stopTimeOfDay;
            }
            try {
                const result = await this.callApi('/schedule', 'POST', payload);
                this.showToast(result.message || this.t('sessionScheduledSuccess'), 'success');
                this.closeActiveModal();
            } catch (error) { /* Toast sudah ditangani oleh callApi */ }
        },
        async handleEditSchedule() {
            const form = this.forms.editSchedule;
            if (!form.streamKey || !form.videoFile) {
                this.showToast(this.t('allFieldsRequired'), 'error'); return;
            }
            let payload = {
                session_name_original: form.sessionNameDisplay, // Menggunakan nama sesi asli
                stream_key: form.streamKey,
                video_file: form.videoFile,
                platform: form.platform,
                recurrence_type: form.recurrenceType
            };
            
            if (form.recurrenceType === 'one_time') {
                if (!form.onetime.startTime) { this.showToast(this.t('scheduleOnetimeStartTimeRequired'), 'error'); return; }
                payload.start_time = form.onetime.startTime;
                payload.duration = form.onetime.durationHours === null || form.onetime.durationHours === '' ? 0 : form.onetime.durationHours;
            } else if (form.recurrenceType === 'daily') {
                if (!form.daily.startTimeOfDay || !form.daily.stopTimeOfDay) { this.showToast(this.t('scheduleDailyTimeRequired'), 'error'); return; }
                payload.start_time_of_day = form.daily.startTimeOfDay;
                payload.stop_time_of_day = form.daily.stopTimeOfDay;
            }
            
            try {
                const result = await this.callApi('/schedule', 'POST', payload);
                this.showToast(result.message || this.t('scheduleUpdatedSuccess'), 'success');
                this.closeActiveModal();
            } catch (error) { /* Toast sudah ditangani oleh callApi */ }
        },
        async stopLiveSession(sessionId) {
            try {
                const result = await this.callApi('/stop', 'POST', { session_id: sessionId });
                this.showToast(result.message || this.t('liveSessionStoppedSuccess'), 'success');
            } catch (error) { /* Toast sudah ditangani oleh callApi */ }
        },
        async cancelScheduledSession(scheduleDefinitionId) {
            try {
                const result = await this.callApi('/cancel-schedule', 'POST', { id: scheduleDefinitionId });
                this.showToast(result.message || this.t('scheduleCancelledSuccess'), 'success');
            } catch (error) { /* Toast sudah ditangani oleh callApi */ }
        },
        async reactivateSession(sessionId) {
             try {
                const result = await this.callApi('/reactivate', 'POST', { session_id: sessionId });
                this.showToast(result.message || this.t('sessionReactivatedSuccess'), 'success');
            } catch (error) { /* Toast sudah ditangani oleh callApi */ }
        },
        async handleEditReschedule() {
            const form = this.forms.editReschedule;
            if (!form.streamKey || !form.videoFile) {
                this.showToast(this.t('allFieldsRequired'), 'error'); return;
            }
            let payload = {
                session_name_original: form.id, // Menggunakan ID sesi asli
                stream_key: form.streamKey,
                video_file: form.videoFile,
                platform: form.platform
            };
            let endpoint = '/edit-session'; // Default untuk edit detail
            if (form.recurrenceType) { // Jika tipe jadwal dipilih, berarti reschedule
                endpoint = '/schedule';
                payload.recurrence_type = form.recurrenceType;
                if (form.recurrenceType === 'one_time') {
                    if (!form.onetime.startTime) { this.showToast(this.t('scheduleOnetimeStartTimeRequired'), 'error'); return; }
                    payload.start_time = form.onetime.startTime;
                    payload.duration = form.onetime.durationHours === null || form.onetime.durationHours === '' ? 0 : form.onetime.durationHours;
                } else if (form.recurrenceType === 'daily') {
                    if (!form.daily.startTimeOfDay || !form.daily.stopTimeOfDay) { this.showToast(this.t('scheduleDailyTimeRequired'), 'error'); return; }
                    payload.start_time_of_day = form.daily.startTimeOfDay;
                    payload.stop_time_of_day = form.daily.stopTimeOfDay;
                }
            }
            try {
                const result = await this.callApi(endpoint, 'POST', payload);
                this.showToast(result.message || (endpoint === '/schedule' ? this.t('sessionRescheduledSuccess') : this.t('sessionDetailsUpdatedSuccess')), 'success');
                this.closeActiveModal();
            } catch (error) { /* Toast sudah ditangani oleh callApi */ }
        },
        async deleteInactiveSession(sessionId) {
            try {
                const result = await this.callApi('/delete-session', 'POST', { session_id: sessionId });
                this.showToast(result.message || this.t('inactiveSessionDeletedSuccess'), 'success');
            } catch (error) { /* Toast sudah ditangani oleh callApi */ }
        },
        async deleteAllInactiveSessions() {
            // Pengecekan awal apakah ada sesi nonaktif untuk dihapus
            if (this.inactiveSessions.length === 0) {
                this.showToast(this.t('noInactiveSessionsMessage'), 'info');
                return;
            }
            // Proses konfirmasi kepada pengguna sudah ditangani oleh atribut @click="confirmAction(...)" pada elemen tombol HTML.

            this.loadingStates.inactiveSessions = true; // Aktifkan status loading
            try {
                // Panggil endpoint backend baru yang menghapus semua sesi nonaktif sekaligus
                const result = await this.callApi('/inactive-sessions/delete-all', 'POST');
                
                // Tampilkan pesan sukses dari backend.
                // Berdasarkan implementasi backend, result.message akan berisi pesan seperti:
                // 'Berhasil menghapus X sesi tidak aktif.'
                // result.deleted_count juga tersedia.
                this.showToast(result.message || 
                               this.t('inactiveSessionDeletedSuccessCount', { count: result.deleted_count }) || // Fallback jika result.message kosong
                               'Semua sesi nonaktif berhasil dihapus.', // Fallback paling akhir
                               'success');
                
                // Daftar sesi nonaktif akan diperbarui secara otomatis melalui event WebSocket 'inactive_sessions_update'
                // yang dikirim oleh backend setelah penghapusan berhasil.
                // Jika karena alasan tertentu pembaruan via WebSocket tidak terjadi, Anda bisa menambahkan:
                // await this.fetchInactiveSessions(); 
                // di sini untuk memastikan data di frontend selalu sinkron.

            } catch (error) {
                // Penanganan error (seperti masalah jaringan atau respons error dari server) 
                // umumnya sudah ditangani oleh fungsi this.callApi, yang akan menampilkan toast error.
                // Baris di bawah ini bisa ditambahkan jika Anda ingin penanganan error spesifik di sini.
                // this.showToast(error.message || this.t('networkError'), 'error');
                console.error("Gagal menghapus semua sesi nonaktif:", error);
            } finally {
                this.loadingStates.inactiveSessions = false; // Nonaktifkan status loading, baik berhasil maupun gagal
            }
        },
        setupSocketIO() {
            console.log("[Alpine] setupSocketIO: Mencoba menghubungkan ke", SOCKET_URL);
            if (this.socket) { this.socket.disconnect(); } // Disconnect dulu jika sudah ada
            this.socket = io(SOCKET_URL, { withCredentials: true, transports: ['websocket', 'polling'] });
            
            this.socket.on('connect', () => { this.showToast(this.t('connectedToSocket'), 'success'); console.log("[Alpine] Socket.IO Terhubung!"); });
            this.socket.on('disconnect', (reason) => { this.showToast(this.t('disconnectedFromSocket') + ` (${reason})`, 'warning'); console.log("[Alpine] Socket.IO Terputus:", reason);});
            this.socket.on('connect_error', (err) => { this.showToast(this.t('socketConnectionError', {error: err.message}), 'error'); console.error("[Alpine] Kesalahan koneksi Socket.IO:", err); });

            this.socket.on('videos_update', (data_filenames) => {
                console.log("[Alpine] Socket.IO 'videos_update' diterima:", data_filenames);
                this.videos = Array.isArray(data_filenames) ? data_filenames.map(filename => ({ id: filename, name: filename, url: `${CURRENT_ORIGIN}/videos/${encodeURIComponent(filename)}` })) : [];
                this.showToast(this.t('videosUpdated'), 'info');
            });
            this.socket.on('sessions_update', (data_sessions) => { console.log("[Alpine] Socket.IO 'sessions_update' diterima:", data_sessions); this.liveSessions = Array.isArray(data_sessions) ? data_sessions : []; this.showToast(this.t('liveSessionsUpdated'), 'info'); });
            this.socket.on('schedules_update', (data_schedules) => { console.log("[Alpine] Socket.IO 'schedules_update' diterima:", data_schedules); this.scheduledSessions = Array.isArray(data_schedules) ? data_schedules : []; this.showToast(this.t('scheduledSessionsUpdated'), 'info'); });
            this.socket.on('inactive_sessions_update', (data_wrapper) => { 
                console.log("[Alpine] Socket.IO 'inactive_sessions_update' diterima:", data_wrapper); 
                this.inactiveSessions = (data_wrapper && Array.isArray(data_wrapper.inactive_sessions)) ? data_wrapper.inactive_sessions : []; 
                this.loadingStates.inactiveSessions = false; // <-- Tambahkan ini
                this.showToast(this.t('inactiveSessionsUpdated'), 'info'); 
            });
            this.socket.on('trial_status_update', (data) => {
                console.log("[Alpine] Socket.IO 'trial_status_update' diterima:", data);
                this.trialMode.active = data.is_trial;
                this.trialMode.message = data.is_trial ? `${this.t('trialModeIndicatorPrefix')} ${data.message}` : '';
                if (data.is_trial) this.showToast(this.trialMode.message, 'info', 7000);
            });
             this.socket.on('trial_reset_notification', (data) => {
                console.log("[Alpine] Socket.IO 'trial_reset_notification' diterima:", data);
                const prefix = this.t('trialResetNotificationPrefix') || (this.currentLang === 'id' ? "PERHATIAN (Mode Trial):" : "ATTENTION (Trial Mode):");
                this.showToast(`${prefix} ${data.message}`, 'error', 10000);
                this.fetchInitialData(); // Refresh semua data
            });
             this.socket.on('disk_usage_update', (data_disk_usage_wrapper) => { // Tambahkan listener ini
                 console.log("[Alpine] Socket.IO 'disk_usage_update' diterima:", data_disk_usage_wrapper);
                 if (data_disk_usage_wrapper && data_disk_usage_wrapper.disk_usage) {
                    this.diskUsage = data_disk_usage_wrapper.disk_usage;
                } else if (data_disk_usage_wrapper) { // Jika backend mengirim langsung objek disk_usage
                    this.diskUsage = data_disk_usage_wrapper;
                }
            });
        },
        formatDateTime(isoString) {
            if (!isoString) return 'N/A';
            try {
                const date = new Date(isoString);
                const locale = this.currentLang === 'id' ? 'id-ID' : 'en-US';
                return date.toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
            } catch (e) { return this.t('invalidDate'); }
        },
        formatToDateTimeLocal(isoStringOrDate) {
            try {
                const date = (isoStringOrDate instanceof Date) ? isoStringOrDate : new Date(isoStringOrDate);
                // Format YYYY-MM-DDTHH:mm
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day}T${hours}:${minutes}`;
            } catch (e) { return ''; }
        },
        mapScheduleTypeToDisplay(typeKey) {
            return this.t(typeKey) || this.t('unknown');
        },
        
        formatDuration(startTimeIso, stopTimeIso) {
            if (!startTimeIso || !stopTimeIso) {
                return this.t('durationNotAvailable') || 'N/A';
            }
            try {
                const start = new Date(startTimeIso);
                const stop = new Date(stopTimeIso);
                
                // Pastikan tanggal valid dan waktu berhenti setelah waktu mulai
                if (isNaN(start.getTime()) || isNaN(stop.getTime()) || stop < start) {
                    console.warn("Data waktu tidak valid untuk perhitungan durasi:", startTimeIso, stopTimeIso);
                    return this.t('durationInvalidData') || 'Data Waktu Invalid';
                }

                let diffMs = stop - start; // Selisih dalam milidetik
                
                const totalMinutes = Math.floor(diffMs / 60000); // Total menit
                const hours = Math.floor(totalMinutes / 60);    // Jam penuh
                const minutes = totalMinutes % 60;              // Sisa menit

                let durationParts = [];
                if (hours > 0) {
                    durationParts.push(`${hours} ${this.t('hoursSuffixShort') || 'Jam'}`);
                }
                if (minutes > 0) {
                    durationParts.push(`${minutes} ${this.t('minutesSuffixShort') || 'Menit'}`);
                }
                
                // Jika durasi sangat pendek (kurang dari 1 menit tapi lebih dari 0 detik)
                if (hours === 0 && minutes === 0 && diffMs > 0) {
                    return this.t('lessThanAMinute') || 'Kurang dari 1 menit';
                }
                // Jika durasi persis 0 atau negatif (setelah validasi di atas, ini seharusnya 0 menit)
                if (durationParts.length === 0) {
                    return `0 ${this.t('minutesSuffixShort') || 'Menit'}`;
                }
                
                return durationParts.join(' ');

            } catch (e) {
                console.error("Error saat menghitung durasi:", e, "Input:", startTimeIso, stopTimeIso);
                return this.t('durationError') || 'Error Durasi';
            }
        },

        rawNavigation: [
            { id: 'dashboard', nameKey: 'navDashboard', icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h12A2.25 2.25 0 0 0 20.25 14.25V3M3.75 19.5h16.5M5.625 7.5h12.75m-12.75 3h12.75M21 17.25C21 18.4914 20.0086 19.5 18.75 19.5H5.25C4.00858 19.5 3 18.4914 3 17.25V6.75C3 5.50858 4.00858 4.5 5.25 4.5H18.75C20.0086 4.5 21 5.50858 21 6.75V17.25Z" /></svg>' },
            { id: 'videos', nameKey: 'navVideos', icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 13.5 5.25h-9a2.25 2.25 0 0 0-2.25 2.25v9A2.25 2.25 0 0 0 4.5 18.75Z" /></svg>' },
            { id: 'live-sessions', nameKey: 'navLiveSessions', icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="text-danger"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75m-2.625 0a2.625 2.625 0 1 0 5.25 0 2.625 2.625 0 1 0-5.25 0Z" /></svg>' },
            { id: 'scheduled-sessions', nameKey: 'navScheduledSessions', icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5M12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" /></svg>' },
            { id: 'inactive-sessions', nameKey: 'navInactiveSessions', icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>' },
        ],
    }));
});