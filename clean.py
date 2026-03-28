import os
import shutil
from pathlib import Path

def clean_pycache(directory):
    """
    Recursively deletes all __pycache__ directories and .pyc files
    """
    count_dir = 0
    count_file = 0
    
    # Walk through the directory tree
    for root, dirs, files in os.walk(directory):
        # Delete __pycache__ folders
        for d in list(dirs):
            if d == '__pycache__':
                path = os.path.join(root, d)
                try:
                    shutil.rmtree(path)
                    print(f"Removed directory: {path}")
                    count_dir += 1
                except Exception as e:
                    print(f"Error removing {path}: {e}")
        
        # Delete .pyc and .pyo files just in case
        for f in files:
            if f.endswith('.pyc') or f.endswith('.pyo'):
                path = os.path.join(root, f)
                try:
                    os.remove(path)
                    print(f"Removed file: {path}")
                    count_file += 1
                except Exception as e:
                    print(f"Error removing {path}: {e}")

    print("-" * 30)
    print(f"Cleaning complete!")
    print(f"Directories removed: {count_dir}")
    print(f"Files removed: {count_file}")
    print("-" * 30)

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    print(f"Starting cleanup in: {current_dir}")
    clean_pycache(current_dir)
