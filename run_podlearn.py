"""PodLearn entry point."""

import os
import sys
import subprocess
import atexit
from app import create_app

import time
from urllib.parse import urlparse

app = create_app()
celery_app = app.extensions.get("celery")

celery_process = None
redis_process = None

def check_redis():
    """Check if Redis is running before starting Celery."""
    import socket
    from urllib.parse import urlparse
    
    redis_url = app.config.get('CELERY', {}).get('broker_url', 'redis://localhost:6379/0')
    parsed = urlparse(redis_url)
    host = parsed.hostname or 'localhost'
    port = parsed.port or 6379
    
    try:
        s = socket.create_connection((host, port), timeout=2)
        s.close()
        return True
    except:
        return False

def start_redis_server():
    """Attempt to start a dedicated Redis instance for this project."""
    global redis_process
    
    redis_url = app.config.get('CELERY', {}).get('broker_url', 'redis://localhost:6379/0')
    parsed = urlparse(redis_url)
    port = str(parsed.port or 6379)
    
    if check_redis():
        print(f" Redis is already running on port {port}. Using existing instance.")
        return True

    print(f"Starting dedicated Redis server on port {port}...")
    try:
        # We try to call redis-server. 
        # If it's not in PATH, this will fail and we'll show a helpful message.
        redis_process = subprocess.Popen(
            ['redis-server', '--port', port],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
        )
        # Give it a moment to bind to the port
        time.sleep(2)
        
        if check_redis():
            print(f" Dedicated Redis started successfully.")
            return True
        else:
            print(f" [!] Redis process started but port {port} is still not responding.")
            return False
    except Exception as e:
        print(f" [!] Could not start redis-server automatically: {e}")
        print(f" [!] Please ensure 'redis-server' is in your PATH or start it manually on port {port}.")
        return False

def start_celery():
    global celery_process
    
    redis_url = app.config.get('CELERY', {}).get('broker_url', '')
    if 'redis' in redis_url:
        # If user explicitly wants redis, try to start it
        if not start_redis_server():
            print(" [!] WARNING: Redis requested but not found. Celery might fail.")
    else:
        print(" [!] Celery is using SQLite (Database) as broker. No Redis needed.")

    # 2. Start Celery
    print("Starting Celery worker in background...")
    # pool=solo is used for better Windows compatibility
    cmd = [
        sys.executable, "-m", "celery", 
        "-A", "run_podlearn:celery_app", 
        "worker", 
        "-Q", "podlearn_tasks", 
        "--pool=solo", 
        "--loglevel=info"
    ]
    # Use CREATE_NEW_PROCESS_GROUP on Windows to avoid signals killing Flask process killing Celery process abruptly
    kwargs = {
        'cwd': os.path.dirname(os.path.abspath(__file__))
    }
    if os.name == 'nt':
        kwargs['creationflags'] = subprocess.CREATE_NEW_PROCESS_GROUP

    celery_process = subprocess.Popen(cmd, **kwargs)

def cleanup():
    global celery_process, redis_process
    if celery_process:
        print("Stopping Celery worker...")
        celery_process.terminate()
        celery_process.wait()
        celery_process = None
    
    if redis_process:
        print("Stopping dedicated Redis server...")
        redis_process.terminate()
        redis_process.wait()
        redis_process = None

atexit.register(cleanup)

if __name__ == '__main__':
    # 1. Ensure essential directories exist
    base_dir = os.path.dirname(os.path.abspath(__file__))
    storage_dir = os.path.abspath(os.path.join(base_dir, '..', 'Storage'))
    db_dir = os.path.join(storage_dir, 'database')
    media_dir = os.path.join(storage_dir, 'uploads', 'PodLearnMedia')
    logs_dir = os.path.join(base_dir, 'logs')
    
    for d in [db_dir, media_dir, logs_dir]:
        if not os.path.exists(d):
            os.makedirs(d, exist_ok=True)
            print(f"Created directory: {d}")

    # 2. Automatic Database Migration (Alembic) - DISABLED temporarily to fix startup issues
    # if os.path.exists(os.path.join(base_dir, 'migrations')):
    #     print("Checking for database migrations...")
    #     try:
    #         from flask_migrate import upgrade as flask_db_upgrade
    #         with app.app_context():
    #             flask_db_upgrade()
    #         print(" Database is up to date.")
    #     except Exception as e:
    #         print(f" [!] Migration notice: {e}")
    # else:
    #     print(" No migrations folder found, skipping auto-upgrade.")

    # 3. Build Frontend (Windows only, and only in main process)
    if os.name == 'nt' and os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        try:
            import build_vite
            build_vite.build_frontend()
        except ImportError:
            print(" [!] build_vite.py not found. Skipping automatic build.")

    # 4. Start Celery
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.debug:
        if not os.environ.get('SKIP_CELERY'):
            start_celery()

    app.run(debug=True, port=5020)
