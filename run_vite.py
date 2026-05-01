import os
import subprocess
import time

def run_dev():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(root_dir, 'frontend')

    print("Starting Unified Vite Dev Server (Main + Admin)...")
    proc = subprocess.Popen("npm run dev", shell=True, cwd=frontend_dir)
    
    try:
        while True:
            time.sleep(1)
            if proc.poll() is not None:
                break
    except KeyboardInterrupt:
        print("\nStopping server...")
        proc.terminate()
        print("Done.")

if __name__ == "__main__":
    run_dev()
