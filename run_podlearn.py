"""PodLearn entry point (FastAPI version)."""

import os
import sys
import subprocess
import atexit
import uvicorn
import time
from urllib.parse import urlparse
from app import app, celery_app

celery_process = None
redis_process = None

def check_redis():
    """Check if Redis is running before starting Celery."""
    import socket
    from app.core.config import settings
    
    redis_url = settings.CELERY_BROKER_URL
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
    from app.core.config import settings
    
    redis_url = settings.CELERY_BROKER_URL
    parsed = urlparse(redis_url)
    port = str(parsed.port or 6379)
    
    if check_redis():
        print(f" Redis is already running on port {port}. Using existing instance.")
        return True

    print(f"Starting dedicated Redis server on port {port}...")
    try:
        redis_process = subprocess.Popen(
            ['redis-server', '--port', port],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
        )
        time.sleep(2)
        
        if check_redis():
            print(f" Dedicated Redis started successfully.")
            return True
        else:
            print(f" [!] Redis process started but port {port} is still not responding.")
            return False
    except Exception as e:
        print(f" [!] Could not start redis-server automatically: {e}")
        return False

def start_celery():
    global celery_process
    from app.core.config import settings
    
    redis_url = settings.CELERY_BROKER_URL
    if 'redis' in redis_url:
        if not start_redis_server():
            print(" [!] WARNING: Redis requested but not found. Celery might fail.")
    else:
        print(" [!] Celery is using Database as broker. No Redis needed.")

    print("Starting Celery worker in background...")
    cmd = [
        sys.executable, "-m", "celery", 
        "-A", "run_podlearn:celery_app", 
        "worker", 
        "-Q", "podlearn_tasks", 
        "--pool=solo", 
        "--loglevel=info"
    ]
    kwargs = {'cwd': os.path.dirname(os.path.abspath(__file__))}
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
    logs_dir = os.path.join(base_dir, 'logs')
    if not os.path.exists(logs_dir):
        os.makedirs(logs_dir, exist_ok=True)

    # 2. Build Frontend (Optional, Windows only)
    if os.name == 'nt':
        try:
            import build_vite
            build_vite.build_frontend()
        except ImportError:
            pass

    # 3. Start Celery if needed
    from app.core.config import settings
    if settings.TASK_RUNNER == 'celery':
        if not os.environ.get('SKIP_CELERY'):
            start_celery()

    # 4. Start FastAPI
    print(f"Starting PodLearn FastAPI on port 5020...")
    uvicorn.run("app:app", host="0.0.0.0", port=5020, reload=True)
