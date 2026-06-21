import os
import subprocess
import sys

def fix_lookbehinds(project_dir):
    """Replaces all positive lookbehinds with non-capturing groups to support older WebKit/iOS versions."""
    assets_dir = os.path.join(project_dir, "app", "core", "static", "dist", "assets")
    if not os.path.exists(assets_dir):
        print(" [!] Assets directory not found for lookbehind fix.")
        return
    
    print(" [VITE] Post-processing assets to remove Regex Lookbehinds...")
    found = False
    for f in os.listdir(assets_dir):
        if f.endswith(".js"):
            path = os.path.join(assets_dir, f)
            try:
                with open(path, "r", encoding="utf-8") as file_obj:
                    content = file_obj.read()
                if "(?<=" in content:
                    print(f"  [+] Replacing lookbehinds in {f}")
                    content = content.replace("(?<=", "(?:")
                    with open(path, "w", encoding="utf-8") as file_obj:
                        file_obj.write(content)
                    found = True
            except Exception as e:
                print(f"  [-] Failed to process {f}: {e}")
    if not found:
        print("  [+] No lookbehinds found in assets.")

def build_frontend():
    """Build the React frontend using npm."""
    if os.environ.get('SKIP_BUILD'):
        print(" [!] Skipping frontend build as requested.")
        return

    # Check if we are on Windows (NT)
    if os.name != 'nt':
        print(" [!] Not on Windows. Skipping automatic build to avoid server overhead.")
        return

    project_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(project_dir, 'frontend')
    
    if not os.path.exists(frontend_dir):
        print(f" [!] Frontend directory not found at {frontend_dir}. Skipping build.")
        return

    print("--- PodLearn Build System ---")
    print(f"Building React frontend in {frontend_dir}...")
    
    try:
        # Check if node_modules exists
        if not os.path.exists(os.path.join(frontend_dir, 'node_modules')):
            print(" [!] node_modules missing. Running npm install first...")
            subprocess.run(['npm', 'install'], cwd=frontend_dir, check=True, shell=True)

        # Run build
        subprocess.run(['npm', 'run', 'build'], cwd=frontend_dir, check=True, shell=True)
        
        # Run lookbehind fix directly
        fix_lookbehinds(project_dir)
        
        print(" [+] Frontend build successful.")
        print("--------------------------------")
    except Exception as e:
        print(f" [!] Frontend build failed: {e}")
        print(" [!] Continuing with existing assets if available.")

if __name__ == '__main__':
    build_frontend()

