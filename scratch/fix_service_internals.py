import os

def fix_moved_service_imports(target_dir):
    for root, dirs, files in os.walk(target_dir):
        # Focus on module internals
        for file in files:
            if file.endswith(".py"):
                path = os.path.join(root, file)
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                new_content = content
                
                # Fix global app imports that were relative to app/services/
                targets = ["extensions", "utils", "services", "tasks", "celery_app", "storage", "exceptions"]
                for t in targets:
                    new_content = new_content.replace(f"from ..{t}", f"from app.{t}")
                    new_content = new_content.replace(f"from ...{t}", f"from app.{t}")
                
                if new_content != content:
                    print(f"Fixing internals in {path}")
                    with open(path, "w", encoding="utf-8") as f:
                        f.write(new_content)

if __name__ == "__main__":
    fix_moved_service_imports("c:\\Code\\Ecosystem\\PodLearn\\app\\modules")
