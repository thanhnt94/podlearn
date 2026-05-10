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
import threading

from app.core.database import SessionLocal
from app.modules.content.models import SubtitleTrack
from app.modules.engagement.models import AppSetting
from deep_translator import GoogleTranslator

logger = logging.getLogger(__name__)

# --- GLOBAL METADATA CACHE ---
YT_INFO_CACHE = {}
YT_CACHE_TTL = 3600 # 1 hour


def _get_ytdlp_opts(extra_opts=None):
    """Centralized yt-dlp options with cookies."""
    current_file = os.path.abspath(__file__)
    base_dir = current_file
    for _ in range(5):
        base_dir = os.path.dirname(base_dir)
    
    cookie_path = os.path.join(base_dir, 'youtube_cookies.txt')

    opts = {
        'quiet': True,
        'no_warnings': True,
        'nocheckcertificate': True,
        'skip_download': True,
        'socket_timeout': 30,
        'connect_timeout': 10,
        'extractor_args': {
            'youtube': {
                'skip': ['hls', 'dash'], 
            }
        },
        'geo_bypass': True,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        },
        'ignoreerrors': True,
        'ignore_no_formats_error': True,
        'noplaylist': True,
        'check_formats': False,
        'listsubtitles': False,
        'writesubtitles': False,
        'writeautomaticsub': False,
        'prefer_ffmpeg': False, 
        'force_ipv4': True,
        'youtube_include_dash_manifest': True,
        'youtube_include_hls_manifest': True,
    }

    # Dynamic Proxy Support
    with SessionLocal() as db:
        proxy_setting = db.query(AppSetting).filter_by(key='YOUTUBE_PROXY_URL').first()
        proxy_url = proxy_setting.value if proxy_setting else None
        
    if proxy_url:
        opts['proxy'] = proxy_url

    if os.path.exists(cookie_path):
        opts['cookiefile'] = cookie_path
    
    if extra_opts:
        opts.update(extra_opts)
        
    return opts

def fetch_info_cached(video_id: str, extra_opts=None):
    """Fetch video info with 1-hour in-memory caching and resilient retry logic."""
    now = time.time()
    req_is_flat = extra_opts.get('extract_flat', False) if extra_opts else False

    if video_id in YT_INFO_CACHE:
        ts, info, cached_is_flat = YT_INFO_CACHE[video_id]
        if now - ts < YT_CACHE_TTL:
            has_sub_keys = 'subtitles' in info or 'automatic_captions' in info
            if not req_is_flat and (cached_is_flat or not has_sub_keys):
                pass 
            else:
                return info
    
    url = f"https://www.youtube.com/watch?v={video_id}"
    
    try:
        ydl_opts = _get_ytdlp_opts(extra_opts)
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if info and ('title' in info or 'subtitles' in info):
                is_flat_result = info.get('_type') == 'url_composite' or ('formats' not in info and 'subtitles' not in info)
                YT_INFO_CACHE[video_id] = (now, info, is_flat_result)
                return info
    except Exception:
        pass

    import random
    time.sleep(random.uniform(1.5, 3.0))
    
    resilient_opts = dict(extra_opts or {})
    resilient_opts.update({
        'extractor_args': {'youtube': {'player_client': ['ios', 'web_embedded', 'tv']}},
        'ignoreerrors': True
    })
    
    try:
        ydl_opts = _get_ytdlp_opts(resilient_opts)
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if info and ('title' in info or 'subtitles' in info):
                is_flat_result = info.get('_type') == 'url_composite' or ('formats' not in info and 'subtitles' not in info)
                YT_INFO_CACHE[video_id] = (now, info, is_flat_result)
                return info
    except Exception:
        pass

    return None


def get_available_subs_from_youtube(video_id: str):
    """Fetch available subtitle languages from YouTube using yt-dlp."""
    try:
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
        
        if not available:
            if video_id in YT_INFO_CACHE:
                del YT_INFO_CACHE[video_id]
            info = fetch_info_cached(video_id, extra_opts={'listsubtitles': True, 'extract_flat': False})
            available = extract_from_info(info) if info else []

        if not info:
            return {"error": "NotFound", "message": "Video not found hoặc bị chặn."}

        return {'subtitles': available}
    except Exception as e:
        return {"error": "Error", "message": str(e)}

def download_and_parse_youtube_sub(video_id: str, lang_code: str, is_auto: bool = False):
    """Download and parse a specific YouTube subtitle track using direct HTTP download."""
    try:
        info = fetch_info_cached(video_id, extra_opts={'listsubtitles': True})
        if not info:
            return {"error": "MetadataFail", "message": "Failed to retrieve video metadata"}

        tracks = info.get('automatic_captions' if is_auto else 'subtitles', {})
        if lang_code not in tracks:
            alt_lang = lang_code.split('-')[0]
            if alt_lang in tracks:
                lang_code = alt_lang
            else:
                return {"error": "TrackNotFound", "message": f"Track {lang_code} not found"}

        track_formats = tracks[lang_code]
        vtt_entry = next((f for f in track_formats if f.get('ext') == 'vtt'), None)
        if not vtt_entry:
            vtt_entry = track_formats[0]
        
        vtt_url = vtt_entry.get('url')
        if not vtt_url:
            return {"error": "UrlMissing", "message": "Subtitle download URL missing"}

        with SessionLocal() as db:
            proxy_setting = db.query(AppSetting).filter_by(key='YOUTUBE_PROXY_URL').first()
            proxy_url = proxy_setting.value if proxy_setting else None
            
        proxies = {"http": proxy_url, "https": proxy_url} if proxy_url else None
        response = requests.get(vtt_url, timeout=15, proxies=proxies)
        response.raise_for_status()
        vtt_content = response.text

        temp_file = os.path.join(tempfile.gettempdir(), f"sub_{video_id}_{lang_code}.vtt")
        with open(temp_file, 'w', encoding='utf-8') as f:
            f.write(vtt_content)

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
        finally:
            if os.path.exists(temp_file):
                os.remove(temp_file)
        
        if not parsed_lines:
            return {"error": "EmptyResult", "message": "No subtitles lines extracted"}

        return {"success": True, "lines": parsed_lines}

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

def parse_subtitle_text(content: str, ext: str = None):
    """Parse subtitle content string (.srt or .vtt)."""
    parsed_lines = []
    try:
        if not ext:
            if 'WEBVTT' in content[:100]:
                ext = '.vtt'
            else:
                ext = '.srt'

        if ext == '.vtt':
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
            return {"error": "EmptyContent", "message": "No lines found"}
            
        return {"success": True, "lines": parsed_lines}
    except Exception as e:
        return {"error": "ParseError", "message": str(e)}

def get_subtitle_track(video_id: int, youtube_id: str, language_code: str) -> SubtitleTrack | None:
    with SessionLocal() as db:
        cached = db.query(SubtitleTrack).filter_by(
            video_id=video_id,
            language_code=language_code
        ).first()

        if cached and cached.content_json:
            return cached

        res = download_and_parse_youtube_sub(youtube_id, language_code, is_auto=True)
        if res.get('error'):
            res = download_and_parse_youtube_sub(youtube_id, language_code, is_auto=False)
            
        entries = res.get('lines')
        if not entries:
            return None

        try:
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
                db.add(track)
                db.flush()

            track.content_json = entries
            db.commit()
            db.refresh(track)
            return track
        except Exception:
            db.rollback()
            return None

def generate_unique_track_name(video_id: int, base_name: str) -> str:
    with SessionLocal() as db:
        existing_names = {t.name for t in db.query(SubtitleTrack).filter_by(video_id=video_id).all()}
    if base_name not in existing_names:
        return base_name
    
    counter = 1
    new_name = f"{base_name} ({counter})"
    while new_name in existing_names:
        counter += 1
        new_name = f"{base_name} ({counter})"
    return new_name

def run_translation_background(track_id: int, target_lang: str, source_lang: str):
    """Background task for translation."""
    with SessionLocal() as db:
        track = db.query(SubtitleTrack).get(track_id)
        if not track or not track.content_json:
            return
        
        lines = track.content_json
        track.total_lines = len(lines)
        track.status = 'translating'
        db.commit()
        
        translator = GoogleTranslator(source=source_lang, target=target_lang)
        translated_lines = []
        
        for i, line in enumerate(lines):
            try:
                text = line.get('text', '').strip()
                t_text = translator.translate(text) if text else ""
                new_line = dict(line)
                new_line['text'] = t_text
                translated_lines.append(new_line)
                
                if i % 5 == 0 or i == len(lines) - 1:
                    track.progress = i + 1
                    db.commit()
            except Exception:
                translated_lines.append(dict(line))
        
        track.content_json = translated_lines
        track.status = 'completed'
        track.progress = len(lines)
        db.commit()

def translate_track_content(lines: list[dict], target_lang: str = 'vi', source_lang: str = 'auto') -> list[dict]:
    if not lines:
        return []
    
    translator = GoogleTranslator(source=source_lang, target=target_lang)
    translated_lines = []
    
    chunk_text = []
    chunk_indices = []
    current_length = 0
    
    for i, line in enumerate(lines):
        text = line.get('text', '')
        if current_length + len(text) > 3500:
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
            
    translated_lines.sort(key=lambda x: x.get('start', 0))
    return translated_lines

def export_track_to_string(track: SubtitleTrack, format: str = 'srt') -> str:
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
    else: 
        for i, line in enumerate(lines):
            start = format_time(line['start'], False)
            end = format_time(line['end'], False)
            output.append(f"{i+1}\n{start} --> {end}\n{line['text']}\n")
            
    return "\n".join(output)

