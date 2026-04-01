"""Subtitle service — fetch, cache, and serve subtitle tracks using yt-dlp and webvtt-py."""

import json
import logging
import os
import tempfile
import webvtt
import yt_dlp

from ..extensions import db
from ..models.subtitle import SubtitleTrack

logger = logging.getLogger(__name__)

def _get_ytdlp_opts(extra_opts=None):
    """Centralized yt-dlp options with cookies."""
    cookie_path = os.path.abspath(os.path.join(os.getcwd(), 'youtube_cookies.txt'))
    opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    }
    if os.path.exists(cookie_path):
        opts['cookiefile'] = cookie_path
    
    if extra_opts:
        opts.update(extra_opts)
    return opts

def get_available_subs_from_youtube(video_id: str):
    """Fetch available subtitle languages from YouTube using yt-dlp."""
    url = f"https://www.youtube.com/watch?v={video_id}"
    ydl_opts = _get_ytdlp_opts()

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            subs = info.get('subtitles', {})
            autos = info.get('automatic_captions', {})
            
            available = []
            # Manual subs
            for code, formats in subs.items():
                available.append({
                    'lang_code': code,
                    'name': formats[0].get('name', code) if formats else code,
                    'is_auto': False
                })
            # Auto subs
            for code, formats in autos.items():
                if any(a['lang_code'] == code for a in available): continue
                available.append({
                    'lang_code': code,
                    'name': (formats[0].get('name', code) if formats else code) + " (Auto)",
                    'is_auto': True
                })
            return {'subtitles': available}
    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e)
        if '429' in error_msg or 'Too Many Requests' in error_msg:
            return {"error": "429", "message": "YouTube đang chặn yêu cầu của máy chủ (Lỗi 429). Vui lòng thử lại sau hoặc Upload file thủ công."}
        return {"error": "YouTube Error", "message": error_msg}
    except Exception as e:
        return {"error": "Error", "message": str(e)}

def download_and_parse_youtube_sub(video_id: str, lang_code: str, is_auto: bool = False):
    """Download and parse a specific YouTube subtitle track."""
    url = f"https://www.youtube.com/watch?v={video_id}"
    temp_dir = tempfile.gettempdir()
    
    ydl_opts = _get_ytdlp_opts({
        'writesubtitles': not is_auto,
        'writeautomaticsub': is_auto,
        'subtitleslangs': [lang_code],
        'subtitlesformat': 'vtt',
        'outtmpl': os.path.join(temp_dir, f'sub_%(id)s_%(lang)s'),
    })

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
            target_path = os.path.join(temp_dir, f'sub_{video_id}_{lang_code}.vtt')
            
            if not os.path.exists(target_path):
                import glob
                matches = glob.glob(os.path.join(temp_dir, f'sub_{video_id}_*.vtt'))
                if matches: target_path = matches[0]
                else: return {"error": "FileNotFound", "message": "Failed to find downloaded subtitle file"}

            parsed_lines = []
            for caption in webvtt.read(target_path):
                s = caption.start_in_seconds
                e = caption.end_in_seconds
                parsed_lines.append({
                    'start': round(s, 3),
                    'end': round(e, 3),
                    'duration': round(e - s, 3),
                    'text': caption.text.replace('\n', ' ').strip()
                })
            
            if os.path.exists(target_path):
                os.remove(target_path)
            return {"success": True, "lines": parsed_lines}
    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e)
        if '429' in error_msg or 'Too Many Requests' in error_msg:
            return {"error": "429", "message": "YouTube đang chặn tải tự động (Lỗi 429). Vui lòng thử lại sau hoặc nộp thủ công."}
        return {"error": "DownloadError", "message": error_msg}
    except Exception as e:
        return {"error": "Error", "message": str(e)}

def _parse_timestamp(ts):
    """Convert SRT/VTT timestamp to seconds."""
    ts = ts.replace(',', '.')
    parts = ts.split(':')
    if len(parts) == 3:
        h, m, s = parts
        return int(h) * 3600 + int(m) * 60 + float(s)
    return 0

def _parse_srt(filepath):
    """Simple regex-based SRT parser."""
    import re
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        content = f.read()
    
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
    parsed_lines = []
    try:
        if ext == '.vtt':
            for caption in webvtt.read(file_path):
                s = caption.start_in_seconds
                e = caption.end_in_seconds
                parsed_lines.append({
                    'start': round(s, 3),
                    'end': round(e, 3),
                    'duration': round(e - s, 3),
                    'text': caption.text.replace('\n', ' ').strip()
                })
        elif ext == '.srt':
            parsed_lines = _parse_srt(file_path)
        else:
            return {"error": "UnsupportedFormat", "message": "Unsupported file format"}
        
        if not parsed_lines:
            return {"error": "EmptyFile", "message": "No lines found in file"}
            
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
            track = SubtitleTrack(
                video_id=video_id,
                language_code=language_code,
                is_auto_generated=True,
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

def get_lines_as_dicts(track: SubtitleTrack) -> list[dict]:
    """Convert a track's lines to a list of dicts for JSON response. 
    Uses content_json field.
    """
    if track.content_json and len(track.content_json) > 0:
        return [
            {
                'index': idx,
                'start': entry['start'],
                'duration': entry['duration'],
                'end': entry.get('end', round(entry['start'] + entry['duration'], 3)),
                'text': entry['text'],
            }
            for idx, entry in enumerate(track.content_json)
        ]

    return []
