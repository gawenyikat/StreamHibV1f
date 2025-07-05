from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_socketio import SocketIO, emit
import json
import os
import subprocess
import threading
import time
from datetime import datetime, timedelta
import pytz
from apscheduler.schedulers.background import BackgroundScheduler
from filelock import FileLock
import paramiko
from scp import SCPClient
import shutil

app = Flask(__name__)
app.secret_key = 'streamhib_v2_secret_key_2025'
socketio = SocketIO(app, cors_allowed_origins="*")

# Global variables
migration_in_progress = False
auto_recovery_enabled = True
scheduler = BackgroundScheduler()

# File paths
SESSIONS_FILE = 'sessions.json'
USERS_FILE = 'users.json'
DOMAIN_CONFIG_FILE = 'domain_config.json'
VIDEOS_DIR = 'videos'

# Ensure directories exist
os.makedirs(VIDEOS_DIR, exist_ok=True)

# Default admin credentials
ADMIN_USERNAME = 'admin'
ADMIN_PASSWORD = 'streamhib2025'

def load_json_file(filename, default=None):
    """Load JSON file with error handling"""
    if default is None:
        default = {}
    
    try:
        if os.path.exists(filename):
            with open(filename, 'r') as f:
                content = f.read().strip()
                if content:
                    return json.loads(content)
        return default
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error loading {filename}: {e}")
        return default

def save_json_file(filename, data):
    """Save JSON file with error handling"""
    try:
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        return True
    except IOError as e:
        print(f"Error saving {filename}: {e}")
        return False

def load_sessions():
    """Load sessions from file"""
    return load_json_file(SESSIONS_FILE, {
        'active_sessions': {},
        'inactive_sessions': {},
        'scheduled_sessions': {}
    })

def save_sessions(sessions_data):
    """Save sessions to file"""
    return save_json_file(SESSIONS_FILE, sessions_data)

def load_users():
    """Load users from file"""
    return load_json_file(USERS_FILE, {})

def save_users(users_data):
    """Save users to file"""
    return save_json_file(USERS_FILE, users_data)

def load_domain_config():
    """Load domain configuration"""
    return load_json_file(DOMAIN_CONFIG_FILE, {})

def save_domain_config(config):
    """Save domain configuration"""
    return save_json_file(DOMAIN_CONFIG_FILE, config)

def is_admin_logged_in():
    """Check if admin is logged in"""
    return session.get('admin_logged_in', False)

def is_customer_logged_in():
    """Check if customer is logged in"""
    return session.get('customer_logged_in', False) and session.get('username')

def recovery_orphaned_sessions():
    """Recovery function for orphaned sessions"""
    global auto_recovery_enabled
    
    if not auto_recovery_enabled:
        print("[RECOVERY] Auto-recovery disabled during migration")
        return
    
    try:
        print("[RECOVERY] Starting orphaned session recovery...")
        
        sessions_data = load_sessions()
        active_sessions = sessions_data.get('active_sessions', {})
        
        if not active_sessions:
            print("[RECOVERY] No active sessions to check")
            return
        
        recovered_count = 0
        moved_to_inactive = 0
        
        for session_id, session_info in list(active_sessions.items()):
            try:
                service_name = f"stream-{session_id}"
                
                # Check if systemd service exists and is running
                result = subprocess.run(
                    ['systemctl', 'is-active', service_name],
                    capture_output=True,
                    text=True
                )
                
                if result.returncode != 0:  # Service not running
                    print(f"[RECOVERY] Found orphaned session: {session_id}")
                    
                    # Check if video file exists
                    video_path = os.path.join(VIDEOS_DIR, session_info.get('video_file', ''))
                    
                    if os.path.exists(video_path):
                        # Try to recover the session
                        if recover_session(session_id, session_info):
                            recovered_count += 1
                            print(f"[RECOVERY] Successfully recovered session: {session_id}")
                        else:
                            # Move to inactive if recovery failed
                            move_to_inactive_sessions(session_id, session_info, sessions_data)
                            moved_to_inactive += 1
                            print(f"[RECOVERY] Moved failed session to inactive: {session_id}")
                    else:
                        # Video file doesn't exist, move to inactive
                        move_to_inactive_sessions(session_id, session_info, sessions_data)
                        moved_to_inactive += 1
                        print(f"[RECOVERY] Video file missing, moved to inactive: {session_id}")
                        
            except Exception as e:
                print(f"[RECOVERY] Error processing session {session_id}: {e}")
                continue
        
        if recovered_count > 0 or moved_to_inactive > 0:
            save_sessions(sessions_data)
            print(f"[RECOVERY] Recovery completed - Recovered: {recovered_count}, Moved to inactive: {moved_to_inactive}")
        else:
            print("[RECOVERY] No orphaned sessions found")
            
    except Exception as e:
        print(f"[RECOVERY] Recovery error: {e}")

def recover_session(session_id, session_info):
    """Recover a single session"""
    try:
        service_name = f"stream-{session_id}"
        video_file = session_info.get('video_file')
        rtmp_url = session_info.get('rtmp_url')
        
        if not video_file or not rtmp_url:
            return False
        
        video_path = os.path.join(VIDEOS_DIR, video_file)
        
        # Create systemd service
        service_content = f"""[Unit]
Description=StreamHib Session {session_id}
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/ffmpeg -re -i "{video_path}" -c copy -f flv "{rtmp_url}"
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
"""
        
        service_file_path = f"/etc/systemd/system/{service_name}.service"
        
        with open(service_file_path, 'w') as f:
            f.write(service_content)
        
        # Reload systemd and start service
        subprocess.run(['systemctl', 'daemon-reload'], check=True)
        subprocess.run(['systemctl', 'enable', service_name], check=True)
        subprocess.run(['systemctl', 'start', service_name], check=True)
        
        return True
        
    except Exception as e:
        print(f"[RECOVERY] Error recovering session {session_id}: {e}")
        return False

def move_to_inactive_sessions(session_id, session_info, sessions_data):
    """Move session to inactive"""
    try:
        # Add to inactive sessions
        if 'inactive_sessions' not in sessions_data:
            sessions_data['inactive_sessions'] = {}
        
        session_info['ended_at'] = datetime.now().isoformat()
        session_info['status'] = 'failed_recovery'
        sessions_data['inactive_sessions'][session_id] = session_info
        
        # Remove from active sessions
        if session_id in sessions_data.get('active_sessions', {}):
            del sessions_data['active_sessions'][session_id]
            
    except Exception as e:
        print(f"[RECOVERY] Error moving session to inactive: {e}")

def cleanup_orphaned_services():
    """Clean up systemd services that don't have corresponding active sessions"""
    try:
        sessions_data = load_sessions()
        active_sessions = sessions_data.get('active_sessions', {})
        
        # Get all stream services
        result = subprocess.run(
            ['systemctl', 'list-units', '--type=service', '--state=running', '--no-legend'],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            services = result.stdout.strip().split('\n')
            cleaned_count = 0
            
            for service_line in services:
                if 'stream-' in service_line:
                    service_name = service_line.split()[0]
                    session_id = service_name.replace('stream-', '').replace('.service', '')
                    
                    if session_id not in active_sessions:
                        try:
                            subprocess.run(['systemctl', 'stop', service_name], check=True)
                            subprocess.run(['systemctl', 'disable', service_name], check=True)
                            
                            service_file = f"/etc/systemd/system/{service_name}"
                            if os.path.exists(service_file):
                                os.remove(service_file)
                            
                            cleaned_count += 1
                            print(f"[CLEANUP] Removed orphaned service: {service_name}")
                            
                        except Exception as e:
                            print(f"[CLEANUP] Error removing service {service_name}: {e}")
            
            if cleaned_count > 0:
                subprocess.run(['systemctl', 'daemon-reload'])
                print(f"[CLEANUP] Cleaned up {cleaned_count} orphaned services")
                
    except Exception as e:
        print(f"[CLEANUP] Error during cleanup: {e}")

# Migration functions
def test_ssh_connection(ip, username, password):
    """Test SSH connection to old server"""
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(ip, username=username, password=password, timeout=10)
        
        # Test basic command
        stdin, stdout, stderr = ssh.exec_command('echo "test"')
        result = stdout.read().decode().strip()
        
        ssh.close()
        
        return result == "test"
        
    except Exception as e:
        print(f"[MIGRATION] SSH test failed: {e}")
        return False

def download_files_from_old_server(ip, username, password):
    """Download files from old server"""
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(ip, username=username, password=password, timeout=30)
        
        # Create backup directory
        backup_dir = f"migration_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        os.makedirs(backup_dir, exist_ok=True)
        
        with SCPClient(ssh.get_transport()) as scp:
            files_to_download = [
                'sessions.json',
                'users.json', 
                'domain_config.json'
            ]
            
            downloaded_files = []
            
            # Download config files
            for file_name in files_to_download:
                try:
                    old_path = f"/root/StreamHibV2/{file_name}"
                    local_path = os.path.join(backup_dir, file_name)
                    
                    scp.get(old_path, local_path)
                    downloaded_files.append(file_name)
                    
                    socketio.emit('migration_log', {
                        'message': f'Downloaded {file_name}',
                        'type': 'success'
                    })
                    
                except Exception as e:
                    socketio.emit('migration_log', {
                        'message': f'Failed to download {file_name}: {str(e)}',
                        'type': 'warning'
                    })
            
            # Download videos directory
            try:
                old_videos_path = "/root/StreamHibV2/videos"
                local_videos_path = os.path.join(backup_dir, "videos")
                
                # Check if videos directory exists on old server
                stdin, stdout, stderr = ssh.exec_command(f'ls -la {old_videos_path}')
                if stdout.channel.recv_exit_status() == 0:
                    scp.get(old_videos_path, local_videos_path, recursive=True)
                    downloaded_files.append('videos/')
                    
                    socketio.emit('migration_log', {
                        'message': 'Downloaded videos directory',
                        'type': 'success'
                    })
                else:
                    socketio.emit('migration_log', {
                        'message': 'No videos directory found on old server',
                        'type': 'info'
                    })
                    
            except Exception as e:
                socketio.emit('migration_log', {
                    'message': f'Failed to download videos: {str(e)}',
                    'type': 'warning'
                })
        
        ssh.close()
        
        # Apply downloaded files
        apply_downloaded_files(backup_dir)
        
        return {
            'success': True,
            'downloaded_files': downloaded_files,
            'backup_dir': backup_dir
        }
        
    except Exception as e:
        print(f"[MIGRATION] Download failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }

def apply_downloaded_files(backup_dir):
    """Apply downloaded files to current server"""
    try:
        # Backup current files
        current_backup = f"current_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        os.makedirs(current_backup, exist_ok=True)
        
        files_to_backup = ['sessions.json', 'users.json', 'domain_config.json']
        
        for file_name in files_to_backup:
            if os.path.exists(file_name):
                shutil.copy2(file_name, os.path.join(current_backup, file_name))
        
        if os.path.exists(VIDEOS_DIR):
            shutil.copytree(VIDEOS_DIR, os.path.join(current_backup, 'videos'))
        
        # Apply new files
        for file_name in files_to_backup:
            source_path = os.path.join(backup_dir, file_name)
            if os.path.exists(source_path):
                shutil.copy2(source_path, file_name)
                socketio.emit('migration_log', {
                    'message': f'Applied {file_name}',
                    'type': 'success'
                })
        
        # Apply videos
        source_videos = os.path.join(backup_dir, 'videos')
        if os.path.exists(source_videos):
            if os.path.exists(VIDEOS_DIR):
                shutil.rmtree(VIDEOS_DIR)
            shutil.copytree(source_videos, VIDEOS_DIR)
            
            socketio.emit('migration_log', {
                'message': 'Applied videos directory',
                'type': 'success'
            })
        
        socketio.emit('migration_log', {
            'message': f'Current files backed up to {current_backup}',
            'type': 'info'
        })
        
    except Exception as e:
        socketio.emit('migration_log', {
            'message': f'Error applying files: {str(e)}',
            'type': 'error'
        })
        raise

def perform_migration(ip, username, password):
    """Perform complete migration process"""
    global migration_in_progress, auto_recovery_enabled
    
    try:
        migration_in_progress = True
        auto_recovery_enabled = False  # Disable auto-recovery during migration
        
        socketio.emit('migration_log', {
            'message': 'Starting migration process...',
            'type': 'info'
        })
        
        # Step 1: Test connection
        socketio.emit('migration_progress', {
            'step': 'connection',
            'progress': 10,
            'message': 'Testing SSH connection...'
        })
        
        if not test_ssh_connection(ip, username, password):
            raise Exception("SSH connection test failed")
        
        socketio.emit('migration_log', {
            'message': 'SSH connection successful',
            'type': 'success'
        })
        
        # Step 2: Download files
        socketio.emit('migration_progress', {
            'step': 'download',
            'progress': 50,
            'message': 'Downloading files from old server...'
        })
        
        download_result = download_files_from_old_server(ip, username, password)
        
        if not download_result['success']:
            raise Exception(f"File download failed: {download_result['error']}")
        
        socketio.emit('migration_log', {
            'message': f"Downloaded files: {', '.join(download_result['downloaded_files'])}",
            'type': 'success'
        })
        
        # Step 3: Migration complete
        socketio.emit('migration_progress', {
            'step': 'recovery',
            'progress': 100,
            'message': 'Migration completed! Ready for manual recovery.'
        })
        
        socketio.emit('migration_complete', {
            'message': 'Migration completed successfully!',
            'downloaded_files': download_result['downloaded_files']
        })
        
    except Exception as e:
        socketio.emit('migration_error', {
            'message': str(e)
        })
        socketio.emit('migration_log', {
            'message': f'Migration failed: {str(e)}',
            'type': 'error'
        })
    finally:
        migration_in_progress = False
        auto_recovery_enabled = True  # Re-enable auto-recovery

# Routes
@app.route('/')
def index():
    if not is_customer_logged_in():
        return redirect(url_for('customer_login'))
    
    username = session.get('username')
    sessions_data = load_sessions()
    
    # Get user's sessions
    user_sessions = {}
    for session_id, session_info in sessions_data.get('active_sessions', {}).items():
        if session_info.get('username') == username:
            user_sessions[session_id] = session_info
    
    # Get available videos
    video_files = []
    if os.path.exists(VIDEOS_DIR):
        for file in os.listdir(VIDEOS_DIR):
            if file.lower().endswith(('.mp4', '.avi', '.mkv', '.mov')):
                video_files.append(file)
    
    return render_template('index.html', 
                         username=username,
                         sessions=user_sessions,
                         video_files=video_files)

@app.route('/login')
def customer_login():
    if is_customer_logged_in():
        return redirect(url_for('index'))
    return render_template('customer_login.html')

@app.route('/register')
def customer_register():
    if is_customer_logged_in():
        return redirect(url_for('index'))
    
    # Check if any users exist (single user mode)
    users = load_users()
    if users:
        return render_template('registration_closed.html')
    
    return render_template('customer_register.html')

@app.route('/admin/login')
def admin_login():
    if is_admin_logged_in():
        return redirect(url_for('admin_index'))
    return render_template('admin_login.html')

@app.route('/admin')
def admin_index():
    if not is_admin_logged_in():
        return redirect(url_for('admin_login'))
    
    # Get statistics
    sessions_data = load_sessions()
    users_data = load_users()
    domain_config = load_domain_config()
    
    stats = {
        'total_users': len(users_data),
        'active_sessions': len(sessions_data.get('active_sessions', {})),
        'inactive_sessions': len(sessions_data.get('inactive_sessions', {})),
        'scheduled_sessions': len(sessions_data.get('scheduled_sessions', {})),
        'total_videos': len([f for f in os.listdir(VIDEOS_DIR) if f.lower().endswith(('.mp4', '.avi', '.mkv', '.mov'))]) if os.path.exists(VIDEOS_DIR) else 0
    }
    
    return render_template('admin_index.html', 
                         stats=stats,
                         sessions=sessions_data,
                         domain_config=domain_config)

@app.route('/admin/users')
def admin_users():
    if not is_admin_logged_in():
        return redirect(url_for('admin_login'))
    
    users = load_users()
    return render_template('admin_users.html', users=users)

@app.route('/admin/migration')
def admin_migration():
    if not is_admin_logged_in():
        return redirect(url_for('admin_login'))
    
    return render_template('admin_migration.html')

@app.route('/admin/recovery')
def admin_recovery():
    if not is_admin_logged_in():
        return redirect(url_for('admin_login'))
    
    return render_template('admin_recovery.html')

@app.route('/admin/domain')
def admin_domain():
    if not is_admin_logged_in():
        return redirect(url_for('admin_login'))
    
    domain_config = load_domain_config()
    return render_template('admin_domain.html', domain_config=domain_config)

@app.route('/admin/logout')
def admin_logout():
    session.pop('admin_logged_in', None)
    return redirect(url_for('admin_login'))

# API Routes
@app.route('/api/customer/login', methods=['POST'])
def api_customer_login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        users = load_users()
        
        if username in users and users[username]['password'] == password:
            session['customer_logged_in'] = True
            session['username'] = username
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'message': 'Invalid credentials'})
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/customer/register', methods=['POST'])
def api_customer_register():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'success': False, 'message': 'Username and password required'})
        
        users = load_users()
        
        # Single user mode - check if any users exist
        if users:
            return jsonify({'success': False, 'message': 'Registration closed - single user mode'})
        
        if username in users:
            return jsonify({'success': False, 'message': 'Username already exists'})
        
        users[username] = {
            'password': password,
            'created_at': datetime.now().isoformat(),
            'role': 'customer'
        }
        
        if save_users(users):
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'message': 'Failed to save user'})
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/login', methods=['POST'])
def api_admin_login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session['admin_logged_in'] = True
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'message': 'Invalid admin credentials'})
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/recovery/manual', methods=['POST'])
def api_manual_recovery():
    try:
        if not is_admin_logged_in():
            return jsonify({'success': False, 'message': 'Admin access required'})
        
        # Perform manual recovery
        sessions_data = load_sessions()
        active_sessions = sessions_data.get('active_sessions', {})
        
        recovered = 0
        moved_to_inactive = 0
        
        for session_id, session_info in list(active_sessions.items()):
            try:
                service_name = f"stream-{session_id}"
                
                # Check if service is running
                result = subprocess.run(
                    ['systemctl', 'is-active', service_name],
                    capture_output=True,
                    text=True
                )
                
                if result.returncode != 0:  # Service not running
                    video_path = os.path.join(VIDEOS_DIR, session_info.get('video_file', ''))
                    
                    if os.path.exists(video_path):
                        if recover_session(session_id, session_info):
                            recovered += 1
                        else:
                            move_to_inactive_sessions(session_id, session_info, sessions_data)
                            moved_to_inactive += 1
                    else:
                        move_to_inactive_sessions(session_id, session_info, sessions_data)
                        moved_to_inactive += 1
                        
            except Exception as e:
                print(f"Error processing session {session_id}: {e}")
                continue
        
        save_sessions(sessions_data)
        
        # Cleanup orphaned services
        cleanup_orphaned_services()
        
        return jsonify({
            'success': True,
            'recovery_result': {
                'recovered': recovered,
                'moved_to_inactive': moved_to_inactive,
                'total_active': len(sessions_data.get('active_sessions', {}))
            },
            'cleanup_count': 0  # Will be implemented later
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

# Migration API Routes
@app.route('/api/migration/test-connection', methods=['POST'])
def api_test_migration_connection():
    try:
        if not is_admin_logged_in():
            return jsonify({'success': False, 'message': 'Admin access required'})
        
        data = request.get_json()
        ip = data.get('ip')
        username = data.get('username')
        password = data.get('password')
        
        if test_ssh_connection(ip, username, password):
            return jsonify({'success': True, 'message': 'Connection successful'})
        else:
            return jsonify({'success': False, 'message': 'Connection failed'})
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/migration/start', methods=['POST'])
def api_start_migration():
    try:
        global migration_in_progress
        
        if not is_admin_logged_in():
            return jsonify({'success': False, 'message': 'Admin access required'})
        
        if migration_in_progress:
            return jsonify({'success': False, 'message': 'Migration already in progress'})
        
        data = request.get_json()
        ip = data.get('ip')
        username = data.get('username')
        password = data.get('password')
        
        # Start migration in background thread
        migration_thread = threading.Thread(
            target=perform_migration,
            args=(ip, username, password)
        )
        migration_thread.start()
        
        return jsonify({'success': True, 'message': 'Migration started'})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/migration/status', methods=['GET'])
def api_migration_status():
    try:
        return jsonify({
            'success': True,
            'migration_in_progress': migration_in_progress,
            'auto_recovery_enabled': auto_recovery_enabled
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/migration/reset', methods=['POST'])
def api_reset_migration():
    try:
        global migration_in_progress, auto_recovery_enabled
        
        if not is_admin_logged_in():
            return jsonify({'success': False, 'message': 'Admin access required'})
        
        migration_in_progress = False
        auto_recovery_enabled = True
        
        return jsonify({'success': True, 'message': 'Migration state reset'})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/migration/recovery', methods=['POST'])
def api_migration_recovery():
    try:
        if not is_admin_logged_in():
            return jsonify({'success': False, 'message': 'Admin access required'})
        
        # Perform recovery after migration
        sessions_data = load_sessions()
        active_sessions = sessions_data.get('active_sessions', {})
        
        recovered = 0
        failed = 0
        
        for session_id, session_info in active_sessions.items():
            try:
                if recover_session(session_id, session_info):
                    recovered += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"Recovery error for session {session_id}: {e}")
                failed += 1
        
        return jsonify({
            'success': True,
            'recovered': recovered,
            'failed': failed,
            'message': f'Recovery completed: {recovered} recovered, {failed} failed'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/migration/rollback', methods=['POST'])
def api_migration_rollback():
    try:
        if not is_admin_logged_in():
            return jsonify({'success': False, 'message': 'Admin access required'})
        
        # Find latest backup directory
        backup_dirs = [d for d in os.listdir('.') if d.startswith('current_backup_')]
        
        if not backup_dirs:
            return jsonify({'success': False, 'message': 'No backup found'})
        
        latest_backup = sorted(backup_dirs)[-1]
        
        # Restore files from backup
        files_to_restore = ['sessions.json', 'users.json', 'domain_config.json']
        
        for file_name in files_to_restore:
            backup_file = os.path.join(latest_backup, file_name)
            if os.path.exists(backup_file):
                shutil.copy2(backup_file, file_name)
        
        # Restore videos
        backup_videos = os.path.join(latest_backup, 'videos')
        if os.path.exists(backup_videos):
            if os.path.exists(VIDEOS_DIR):
                shutil.rmtree(VIDEOS_DIR)
            shutil.copytree(backup_videos, VIDEOS_DIR)
        
        return jsonify({'success': True, 'message': f'Rollback completed from {latest_backup}'})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

# WebSocket events
@socketio.on('connect')
def handle_connect():
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

# Initialize scheduler
def init_scheduler():
    """Initialize the background scheduler"""
    try:
        if not scheduler.running:
            # Add recovery job - runs every 5 minutes
            scheduler.add_job(
                func=recovery_orphaned_sessions,
                trigger="interval",
                minutes=5,
                id='recovery_job',
                name='Orphaned Session Recovery',
                replace_existing=True
            )
            
            scheduler.start()
            print("[SCHEDULER] Background scheduler started")
            print("[SCHEDULER] Recovery job scheduled every 5 minutes")
        
    except Exception as e:
        print(f"[SCHEDULER] Error starting scheduler: {e}")

if __name__ == '__main__':
    # Initialize scheduler
    init_scheduler()
    
    print("StreamHib V2 starting...")
    print(f"Admin credentials: {ADMIN_USERNAME} / {ADMIN_PASSWORD}")
    
    # Run with SocketIO
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)