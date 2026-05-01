import os
import subprocess
import sys

def build_frontend():
    """Build the React frontend using npm."""
    if os.environ.get('SKIP_BUILD'):
        print(" [!] Skipping frontend build as requested.")
        return

    # Check if we are on Windows (NT)
    if os.name != 'nt':
        print(" [!] Not on Windows. Skipping automatic build to avoid server overhead.")
        return

    current_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(current_dir, 'frontend')
    
    if not os.path.exists(frontend_dir):
        print(f" [!] Frontend directory not found at {frontend_dir}. Skipping build.")
        return

    print("--- 🚀 PodLearn Build System ---")
    print(f"Building React frontend in {frontend_dir}...")
    
    try:
        # Check if node_modules exists
        if not os.path.exists(os.path.join(frontend_dir, 'node_modules')):
            print(" [!] node_modules missing. Running npm install first...")
            subprocess.run(['npm', 'install'], cwd=frontend_dir, check=True, shell=True)

        # Run build
        subprocess.run(['npm', 'run', 'build'], cwd=frontend_dir, check=True, shell=True)
        print(" ✅ Frontend build successful.")
        print("--------------------------------")
    except Exception as e:
        print(f" ❌ Frontend build failed: {e}")
        print(" [!] Continuing with existing assets if available.")

if __name__ == '__main__':
    build_frontend()
