"""Subtitle service — fetch, cache, and serve subtitle tracks using yt-dlp and webvtt-py."""

import json
import logging
import os
import requests
import sys
import tempfile
import time
import webvtt
import yt_dlp

from app.core.extensions import db
from app.modules.content.models import SubtitleTrack
from deep_translator import GoogleTranslator

logger = logging.getLogger(__name__)

# --- GLOBAL METADATA CACHE ---
# Stores {video_id: (timestamp, info_dict, is_flat)}
YT_INFO_CACHE = {}
YT_CACHE_TTL = 3600 # 1 hour


def _get_ytdlp_opts(extra_opts=None):
    """Centralized yt-dlp options with cookies."""
    # Robust path resolution: find project root
    current_file = os.path.abspath(__file__)
    # Go up from app/modules/content/services/subtitle_service.py to PodLearn root (5 levels)
    base_dir = current_file
    for _ in range(5):
        base_dir = os.path.dirname(base_dir)
    
    cookie_path = os.path.join(base_dir, 'youtube_cookies.txt')

    sys.stderr.write(f"\n[YT-CONFIG] Project Root detected: {base_dir}\n")
    sys.stderr.write(f"[YT-CONFIG] Checking for cookies at: {cookie_path}\n")
    sys.stderr.write(f"[YT-CONFIG] yt-dlp version: {yt_dlp.version.__version__}\n")

    opts = {
        'quiet': True,
        'no_warnings': True,
        'nocheckcertificate': True,
        'skip_download': True,
        'socket_timeout': 30,
        'connect_timeout': 10,
        'extractor_args': {
            'youtube': {
                'skip': ['dash', 'hls'], # Try skipping manifest to see if it speeds up or bypasses
                'player_client': ['android', 'web'],
            }
        },
        'geo_bypass': True,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.youtube.com/',
            'Origin': 'https://www.youtube.com/',
        },
        'ignoreerrors': True,
        'ignore_no_formats_error': True,
        'noplaylist': True,
        'check_formats': False,
        'listsubtitles': False,
        'writesubtitles': False,
        'writeautomaticsub': False,
        'prefer_ffmpeg': False, 
        'youtube_include_dash_manifest': False,
        'youtube_include_hls_manifest': False,
    }

    if os.path.exists(cookie_path):
        if not os.access(cookie_path, os.R_OK):
            sys.stderr.write(f">>> [PODLEARN ERROR] Cookie file FOUND but NOT READABLE (Permissions issue) <<<\n")
        else:
            try:
                with open(cookie_path, 'r', encoding='utf-8') as f:
                    first_line = f.readline()
                    if "# Netscape HTTP Cookie File" not in first_line:
                        sys.stderr.write(f">>> [PODLEARN ERROR] Cookie file FOUND but INVALID FORMAT (Not Netscape) <<<\n")
                    else:
                        sys.stderr.write(f">>> [PODLEARN SUCCESS] Cookie file LOADED correctly <<<\n")
                        opts['cookiefile'] = cookie_path
            except Exception as e:
                sys.stderr.write(f">>> [PODLEARN ERROR] Exception reading cookies: {e} <<<\n")
    else:
        sys.stderr.write(f">>> [PODLEARN WARN] Cookie file NOT FOUND at {cookie_path} <<<\n")
    
    if extra_opts:
        opts.update(extra_opts)
        
    sys.stderr.flush()
    return opts

def fetch_info_cached(video_id: str, extra_opts=None):
    """Fetch video info with 1-hour in-memory caching. 
    Smart enough to re-fetch if we have a 'flat' cache but need a 'full' one.
    """
    now = time.time()
    req_is_flat = extra_opts.get('extract_flat', False) if extra_opts else False

    if video_id in YT_INFO_CACHE:
        ts, info, cached_is_flat = YT_INFO_CACHE[video_id]
        if now - ts < YT_CACHE_TTL:
            has_sub_keys = 'subtitles' in info or 'automatic_captions' in info
            has_actual_subs = bool(info.get('subtitles') or info.get('automatic_captions'))
            
            # If we need a full extract (req_is_flat=False) but the cache is flat OR has NO sub keys at all
            # (which happens if it was a fast metadata-only extract), we MUST re-fetch.
            if not req_is_flat and (cached_is_flat or not has_sub_keys):
                print(f">>> [YT CACHE] Incomplete data for {video_id} (Flat={cached_is_flat}, HasSubKeys={has_sub_keys}). Upgrading to full fetch... <<<")
            else:
                print(f">>> [YT CACHE] Hit for {video_id} (Flat={cached_is_flat}, HasActualSubs={has_actual_subs}) <<<")
                return info
    
    print(f">>> [YT FETCH] Extracting metadata for {video_id} (Flat={req_is_flat})... <<<")
    url = f"https://www.youtube.com/watch?v={video_id}"
    ydl_opts = _get_ytdlp_opts(extra_opts)
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        if info:
            # A result is flat if it's explicitly marked as composite OR it lacks substantial data like 'formats' or 'subtitles'
            # Note: extract_flat: True often skips 'subtitles' field entirely in the response dict
            is_flat_result = info.get('_type') == 'url_composite' or ('formats' not in info and 'subtitles' not in info)
            YT_INFO_CACHE[video_id] = (now, info, is_flat_result)
        return info


def get_available_subs_from_youtube(video_id: str):
    """Fetch available subtitle languages from YouTube using yt-dlp."""
    try:
        sys.stderr.write(f"\n[YT-DEBUG] get_available_subs_from_youtube called for {video_id}\n")
        info = fetch_info_cached(video_id, extra_opts={'listsubtitles': True})
        
        def extract_from_info(info_dict):
            subs = info_dict.get('subtitles', {}) or {}
            autos = info_dict.get('automatic_captions', {}) or {}
            available = []
            for code, formats in subs.items():
                available.append({'lang_code': code, 'name': formats[0].get('name', code) if formats else code, 'is_auto': False})
            for code, formats in autos.items():
                if any(a['lang_code'] == code for a in available): continue
                available.append({'lang_code': code, 'name': (formats[0].get('name', code) if formats else code) + " (Auto)", 'is_auto': True})
            return available

        available = extract_from_info(info) if info else []
        
        # If still empty, maybe we have a bad/stale cache. FORCE a full fresh extract.
        if not available:
            sys.stderr.write(f"[YT-DEBUG] No subs in cache for {video_id}. Forcing fresh full extraction... \n")
            # Clear cache for this video to ensure we get a fresh hit
            if video_id in YT_INFO_CACHE:
                del YT_INFO_CACHE[video_id]
            
            # Explicitly disable flat extraction and force list subtitles
            info = fetch_info_cached(video_id, extra_opts={
                'extract_flat': False, 
                'listsubtitles': True,
                'force_generic_extractor': False
            })
            available = extract_from_info(info) if info else []
            
        if not info:
            return {"error": "NotFound", "message": "Video not found or inaccessible"}

        sys.stderr.write(f"[YT-DEBUG] SUCCESS: Returning {len(available)} tracks to API\n")
        sys.stderr.flush()
        return {'subtitles': available}
    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e)
        sys.stderr.write(f"[YT-DEBUG] DL ERROR: {error_msg}\n")
        sys.stderr.flush()
        if '429' in error_msg or 'Too Many Requests' in error_msg:
            return {"error": "429", "message": "YouTube đang chặn yêu cầu của máy chủ (Lỗi 429). Vui lòng thử lại sau hoặc Upload file thủ công."}
        return {"error": "YouTube Error", "message": error_msg}
    except Exception as e:
        sys.stderr.write(f"[YT-DEBUG] CRITICAL EXCEPTION: {str(e)}\n")
        sys.stderr.flush()
        return {"error": "Error", "message": str(e)}

def download_and_parse_youtube_sub(video_id: str, lang_code: str, is_auto: bool = False):
    """Download and parse a specific YouTube subtitle track using direct HTTP download."""
    print(f"\n>>> [YT-SUB] Initiating direct-download for {'auto' if is_auto else 'manual'} subtitles: {video_id} ({lang_code}) <<<")
    
    try:
        # 1. Get info (hardened/cached)
        info = fetch_info_cached(video_id, extra_opts={'listsubtitles': True})
        if not info:
            return {"error": "MetadataFail", "message": "Failed to retrieve video metadata for track download"}

        # 2. Locate the track in the info dict
        tracks = info.get('automatic_captions' if is_auto else 'subtitles', {})
        if lang_code not in tracks:
            # Fallback for name mismatch (e.g. en-US vs en)
            alt_lang = lang_code.split('-')[0]
            if alt_lang in tracks:
                print(f">>> [YT-SUB] Redirecting {lang_code} -> {alt_lang} <<<")
                lang_code = alt_lang
            else:
                return {"error": "TrackNotFound", "message": f"Track {lang_code} not found in YouTube metadata"}

        track_formats = tracks[lang_code]
        # 3. Find VTT URL (YouTube provides this)
        vtt_entry = next((f for f in track_formats if f.get('ext') == 'vtt'), None)
        if not vtt_entry:
            # If no VTT, try any entry (srv3, etc) and hope webvtt or future logic handles it
            vtt_entry = track_formats[0]
            print(f">>> [YT-SUB] WARN: No VTT format found. Trying {vtt_entry.get('ext')}... <<<")
        
        vtt_url = vtt_entry.get('url')
        if not vtt_url:
            return {"error": "UrlMissing", "message": "Subtitle download URL missing in metadata"}

        # 4. Direct Download via requests
        print(f">>> [YT-SUB] Fetching VTT from: {vtt_url[:60]}... <<<")
        response = requests.get(vtt_url, timeout=15)
        response.raise_for_status()
        vtt_content = response.text

        # 5. Save and Parse
        temp_file = os.path.join(tempfile.gettempdir(), f"sub_{video_id}_{lang_code}.vtt")
        with open(temp_file, 'w', encoding='utf-8') as f:
            f.write(vtt_content)

        print(f">>> [YT-SUB] Parsing VTT content ({len(vtt_content)} chars)... <<<")
        parsed_lines = []
        try:
            for caption in webvtt.read(temp_file):
                s = caption.start_in_seconds
                e = caption.end_in_seconds
                parsed_lines.append({
                    'start': round(s, 3),
                    'end': round(e, 3),
                    'duration': round(e - s, 3),
                    'text': caption.text.replace('\n', ' ').strip()
                })
        except Exception as parse_err:
            print(f">>> [YT-SUB] PARSE ERROR: {str(parse_err)} <<<")
            # Fallback if VTT parsing fails - might be a different format
            if 'WEBVTT' not in vtt_content[:100]:
                 return {"error": "InvalidFormat", "message": "Downloaded content is not a valid VTT file"}
            raise

        if os.path.exists(temp_file):
            os.remove(temp_file)
        
        if not parsed_lines:
            return {"error": "EmptyResult", "message": "No subtitles lines extracted from file"}

        print(f">>> [YT-SUB] SUCCESS: {len(parsed_lines)} lines extracted <<<")
        sys.stdout.flush()
        return {"success": True, "lines": parsed_lines}

    except Exception as e:
        print(f">>> [YT-SUB] CRITICAL ERROR: {str(e)} <<<")
        sys.stdout.flush()
        return {"error": "Error", "message": str(e)}

def _parse_timestamp(ts):
    """Convert SRT/VTT timestamp to seconds."""
    ts = ts.replace(',', '.')
    parts = ts.split(':')
    if len(parts) == 3:
        h, m, s = parts
        return int(h) * 3600 + int(m) * 60 + float(s)
    return 0

def _parse_srt(content: str):
    """Simple regex-based SRT parser from string content."""
    import re
    
    content = content.replace('\r\n', '\n')
    blocks = content.split('\n\n')
    entries = []
    
    for block in blocks:
        if not block.strip(): continue
        lines = block.strip().split('\n')
        if len(lines) < 3: continue
        
        times = lines[1]
        text = " ".join(lines[2:])
        match = re.search(r'(\d+:\d+:\d+[.,]\d+)\s*-->\s*(\d+:\d+:\d+[.,]\d+)', times)
        if match:
            start = _parse_timestamp(match.group(1))
            end = _parse_timestamp(match.group(2))
            entries.append({
                'start': round(start, 3),
                'end': round(end, 3),
                'duration': round(end - start, 3),
                'text': text.strip()
            })
    return entries

def parse_uploaded_subtitle(file_path, ext):
    """Parse an uploaded subtitle file (.srt or .vtt)."""
    try:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            content = f.read()
        return parse_subtitle_text(content, ext)
    except Exception as e:
        return {"error": "ParseError", "message": str(e)}

def parse_subtitle_text(content: str, ext: str = None):
    """Parse subtitle content string (.srt or .vtt)."""
    parsed_lines = []
    try:
        # Auto-detect if ext not provided
        if not ext:
            if 'WEBVTT' in content[:100]:
                ext = '.vtt'
            else:
                ext = '.srt'

        if ext == '.vtt':
            import tempfile
            import os
            # webvtt library unfortunately often needs a file or a specialized stream
            with tempfile.NamedTemporaryFile(mode='w', suffix='.vtt', delete=False, encoding='utf-8') as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            
            try:
                for caption in webvtt.read(tmp_path):
                    s = caption.start_in_seconds
                    e = caption.end_in_seconds
                    parsed_lines.append({
                        'start': round(s, 3),
                        'end': round(e, 3),
                        'duration': round(e - s, 3),
                        'text': caption.text.replace('\n', ' ').strip()
                    })
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
        elif ext == '.srt':
            parsed_lines = _parse_srt(content)
        else:
            return {"error": "UnsupportedFormat", "message": "Unsupported format"}
        
        if not parsed_lines:
            return {"error": "EmptyContent", "message": "No lines found in content"}
            
        return {"success": True, "lines": parsed_lines}
    except Exception as e:
        return {"error": "ParseError", "message": str(e)}

def get_subtitle_track(video_id: int, youtube_id: str, language_code: str) -> SubtitleTrack | None:
    # 1) Check DB cache
    cached = SubtitleTrack.query.filter_by(
        video_id=video_id,
        language_code=language_code
    ).first()

    if cached and (cached.content_json and len(cached.content_json) > 0):
        logger.info(f'Cache hit: {language_code} subs for video {youtube_id}')
        return cached

    # 2) Fetch from YouTube via yt-dlp
    logger.info(f'Cache miss: manually downloading {language_code} subs for video {youtube_id}')
    
    res = download_and_parse_youtube_sub(youtube_id, language_code, is_auto=True)
    if res.get('error'):
        # Try again with manual subs?
        res = download_and_parse_youtube_sub(youtube_id, language_code, is_auto=False)
        
    entries = res.get('lines')
    if not entries:
        return None

    try:
        # 3) Save to DB
        track = cached  
        if not track:
            base_name = f"{language_code.upper()}_Original"
            track = SubtitleTrack(
                video_id=video_id,
                language_code=language_code,
                is_auto_generated=True,
                is_original=True,
                name=generate_unique_track_name(video_id, base_name)
            )
            db.session.add(track)
            db.session.flush()

        track.content_json = entries
        db.session.commit()
        logger.info(f'Cached {len(entries)} lines for {language_code} / {youtube_id}')
        return track

    except Exception as e:
        db.session.rollback()
        logger.error(f'Failed to save fetched subtitles for {youtube_id}/{language_code}: {e}')
        return None

def generate_unique_track_name(video_id: int, base_name: str) -> str:
    """Ensure a subtitle track name is unique for a given video."""
    existing_names = {t.name for t in SubtitleTrack.query.filter_by(video_id=video_id).all()}
    if base_name not in existing_names:
        return base_name
    
    counter = 1
    new_name = f"{base_name} ({counter})"
    while new_name in existing_names:
        counter += 1
        new_name = f"{base_name} ({counter})"
    return new_name

def translate_track_content(track_id: int, target_lang: str = 'vi', source_lang: str = 'auto'):
    """Translate all lines in a track line-by-line in background."""
    from app.core.extensions import db
    from app.modules.content.models import SubtitleTrack
    import threading
    
    def _run_translation(tid, t_lang, s_lang):
        with db.app.app_context():
            track = SubtitleTrack.query.get(tid)
            if not track or not track.content_json:
                return
            
            lines = track.content_json
            track.total_lines = len(lines)
            track.status = 'translating'
            db.session.commit()
            
            translator = GoogleTranslator(source=s_lang, target=t_lang)
            translated_lines = []
            
            # Process line by line to keep timelines 100% intact
            for i, line in enumerate(lines):
                try:
                    text = line.get('text', '').strip()
                    if text:
                        # Single line translation as requested
                        t_text = translator.translate(text)
                    else:
                        t_text = ""
                    
                    new_line = dict(line)
                    new_line['text'] = t_text
                    translated_lines.append(new_line)
                    
                    # Update progress every 5 lines to reduce DB load
                    if i % 5 == 0 or i == len(lines) - 1:
                        track.progress = i + 1
                        db.session.commit()
                except Exception as e:
                    logger.error(f"Translation error at line {i}: {e}")
                    # Fallback to original text if error
                    translated_lines.append(dict(line))
            
            track.content_json = translated_lines
            track.status = 'completed'
            track.progress = len(lines)
            db.session.commit()

    # Start thread
    thread = threading.Thread(target=_run_translation, args=(track_id, target_lang, source_lang))
    thread.daemon = True
    thread.start()

def get_lines_as_dicts(track: SubtitleTrack) -> list[dict]:
    # ... existing implementation ...
    if track.content_json and len(track.content_json) > 0:
        return [
            {
                'index': idx,
                'start': entry.get('start', 0),
                'duration': entry.get('duration', round(entry.get('end', 0) - entry.get('start', 0), 3)),
                'end': entry.get('end', round(entry.get('start', 0) + entry.get('duration', 0), 3)),
                'text': entry.get('text', ''),
            }
            for idx, entry in enumerate(track.content_json)
        ]

    return []

def translate_track_content(lines: list[dict], target_lang: str = 'vi', source_lang: str = 'auto') -> list[dict]:
    """Translate all lines in a track using Google Translate."""
    if not lines:
        return []
    
    translator = GoogleTranslator(source=source_lang, target=target_lang)
    translated_lines = []
    
    # Process in chunks to avoid API limits (approx 4000 chars per request)
    chunk_text = []
    chunk_indices = []
    current_length = 0
    
    for i, line in enumerate(lines):
        text = line.get('text', '')
        if current_length + len(text) > 3500:
            # Translate current chunk
            batch_result = translator.translate_batch(chunk_text)
            for idx, t_text in zip(chunk_indices, batch_result):
                new_line = dict(lines[idx])
                new_line['text'] = t_text
                translated_lines.append(new_line)
            
            chunk_text = []
            chunk_indices = []
            current_length = 0
            
        chunk_text.append(text)
        chunk_indices.append(i)
        current_length += len(text)
        
    if chunk_text:
        batch_result = translator.translate_batch(chunk_text)
        for idx, t_text in zip(chunk_indices, batch_result):
            new_line = dict(lines[idx])
            new_line['text'] = t_text
            translated_lines.append(new_line)
            
    # Re-sort just in case
    translated_lines.sort(key=lambda x: x.get('start', 0))
    return translated_lines

def export_track_to_string(track: SubtitleTrack, format: str = 'srt') -> str:
    """Export a subtitle track to SRT or VTT string."""
    lines = track.content_json
    if not lines:
        return ""
    
    def format_time(seconds, is_vtt=False):
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = seconds % 60
        ms = int((s - int(s)) * 1000)
        sep = '.' if is_vtt else ','
        return f"{h:02}:{m:02}:{int(s):02}{sep}{ms:03}"

    output = []
    if format == 'vtt':
        output.append("WEBVTT\n")
        for i, line in enumerate(lines):
            start = format_time(line['start'], True)
            end = format_time(line['end'], True)
            output.append(f"{start} --> {end}\n{line['text']}\n")
    else: # Default SRT
        for i, line in enumerate(lines):
            start = format_time(line['start'], False)
            end = format_time(line['end'], False)
            output.append(f"{i+1}\n{start} --> {end}\n{line['text']}\n")
            
    return "\n".join(output)

