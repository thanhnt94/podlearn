import os

path = 'app/modules/content/services/subtitle_service.py'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if 'def get_available_subs_from_youtube(video_id: str):' in line:
        new_lines.append(line)
        new_lines.append('    """Fetch available subtitle languages from YouTube using yt-dlp."""\n')
        new_lines.append('    try:\n')
        new_lines.append('        sys.stderr.write(f"\\n[YT-DEBUG] get_available_subs_from_youtube called for {video_id}\\n")\n')
        new_lines.append('        info = fetch_info_cached(video_id)\n')
        new_lines.append('        \n')
        new_lines.append('        def extract_from_info(info_dict):\n')
        new_lines.append('            subs = info_dict.get(\'subtitles\', {}) or {}\n')
        new_lines.append('            autos = info_dict.get(\'automatic_captions\', {}) or {}\n')
        new_lines.append('            available = []\n')
        new_lines.append('            for code, formats in subs.items():\n')
        new_lines.append('                available.append({\'lang_code\': code, \'name\': formats[0].get(\'name\', code) if formats else code, \'is_auto\': False})\n')
        new_lines.append('            for code, formats in autos.items():\n')
        new_lines.append('                if any(a[\'lang_code\'] == code for a in available): continue\n')
        new_lines.append('                available.append({\'lang_code\': code, \'name\': (formats[0].get(\'name\', code) if formats else code) + " (Auto)", \'is_auto\': True})\n')
        new_lines.append('            return available\n')
        new_lines.append('\n')
        new_lines.append('        available = extract_from_info(info) if info else []\n')
        new_lines.append('        \n')
        new_lines.append('        # If still empty, maybe we have a bad/stale cache. FORCE a full fresh extract.\n')
        new_lines.append('        if not available:\n')
        new_lines.append('            sys.stderr.write(f"[YT-DEBUG] No subs in cache for {video_id}. Forcing fresh full extraction... \\n")\n')
        new_lines.append('            info = fetch_info_cached(video_id, extra_opts={\'extract_flat\': False})\n')
        new_lines.append('            available = extract_from_info(info) if info else []\n')
        new_lines.append('            \n')
        new_lines.append('        if not info:\n')
        new_lines.append('            return {"error": "NotFound", "message": "Video not found or inaccessible"}\n')
        new_lines.append('\n')
        new_lines.append('        sys.stderr.write(f"[YT-DEBUG] SUCCESS: Returning {len(available)} tracks to API\\n")\n')
        new_lines.append('        sys.stderr.flush()\n')
        new_lines.append('        return {\'subtitles\': available}\n')
        skip = True
    elif skip and 'except yt_dlp.utils.DownloadError as e:' in line:
        new_lines.append(line)
        skip = False
    elif not skip:
        new_lines.append(line)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print("Successfully patched subtitle_service.py")
