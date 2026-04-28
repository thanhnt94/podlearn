import re

files = ['app/modules/study/models.py', 'app/modules/engagement/models.py']

for f_path in files:
    with open(f_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove all from ..extensions import db
    content = re.sub(r'from \.\.extensions import db\n', '', content)
    # Remove all from datetime import datetime, timezone
    content = re.sub(r'from datetime import datetime, timezone\n', '', content)
    content = re.sub(r'from datetime import datetime\n', '', content)

    # Prepend correct imports at the top
    top_imports = "from datetime import datetime, timezone\nfrom app.extensions import db\n\n"
    content = top_imports + content

    with open(f_path, 'w', encoding='utf-8') as f:
        f.write(content)
print("Cleaned up imports")
