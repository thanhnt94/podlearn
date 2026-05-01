import re

api_path = 'app/modules/study/routes/api.py'
legacy_path = 'app/modules/study/routes/api_legacy.py'

with open(api_path, 'r', encoding='utf-8') as f:
    api_content = f.read()

with open(legacy_path, 'r', encoding='utf-8') as f:
    legacy_content = f.read()

# Get all routes in current api.py
api_routes = re.findall(r"@(?:study_api_bp|api_bp)\.route\('(.+?)'", api_content)

# Find all route blocks in legacy_content
# Matches @api_bp.route, any intermediate decorators, and the function definition
route_pattern = re.compile(r"(@api_bp\.route\('(.+?)'[\s\S]+?\ndef (.+?)\(.*?\)[\s\S]+?)(?=\n@api_bp\.route|\Z)")

missing_code = []
for match in route_pattern.finditer(legacy_content):
    full_block = match.group(1)
    route_path = match.group(2)
    func_name = match.group(3)
    
    if route_path not in api_routes:
        block = match.group(0)
        # Convert @api_bp to @study_api_bp
        block = block.replace('@api_bp', '@study_api_bp')
        missing_code.append(block)

if missing_code:
    # Append before health route or at the end
    health_marker = "@study_api_bp.route('/health'"
    if health_marker in api_content:
        parts = api_content.split(health_marker)
        new_content = parts[0] + "\n\n" + "\n\n".join(missing_code) + "\n\n" + health_marker + parts[1]
    else:
        new_content = api_content + "\n\n" + "\n\n".join(missing_code)
    
    with open(api_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Restored {len(missing_code)} missing routes.")
else:
    print("No missing routes found to restore.")
