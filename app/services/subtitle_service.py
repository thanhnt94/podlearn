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

def get_subtitle_track(video_id: int, youtube_id: str, language_code: str) -> SubtitleTrack | None:
    """Get a subtitle track — from DB cache first, then manually download from YouTube."""

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
    
    entries = _fetch_subs_via_ytdlp(youtube_id, language_code)
    if not entries:
        return None

    try:
        # 3) Save to DB
        track = cached  # Reuse existing track record if it exists but has no lines
        if not track:
            track = SubtitleTrack(
                video_id=video_id,
                language_code=language_code,
                is_auto_generated=True, # We treat all downloaded as potentially auto-generated
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


def _fetch_subs_via_ytdlp(youtube_id: str, lang_code: str) -> list[dict] | None:
    """Download .vtt using yt-dlp, parse it using webvtt-py, and clean up."""
    
    with tempfile.TemporaryDirectory() as tmpdir:
        output_template = os.path.join(tmpdir, f"{youtube_id}_%(ext)s")
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,              # Skip video/audio
            'writesubtitles': True,             # Try manual subs first
            'writeautomaticsub': True,          # Fallback to auto-generated subs
            'subtitleslangs': [lang_code],      # Restrict to requested lang
            'subtitlesformat': 'vtt',           # Force VTT layout for webvtt-py parser
            'outtmpl': output_template,
            # Uncomment if you run into 429s to bypass it using your local Chrome cookies
            # 'cookiesfrombrowser': ('chrome',), 
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([f"https://www.youtube.com/watch?v={youtube_id}"])
        except Exception as e:
            logger.error(f'yt-dlp failed to extract subtitles: {e}')
            return None

        # yt-dlp names downloaded VTT files dynamically (e.g., id.en.vtt or id.ja.vtt)
        vtt_file = next((f for f in os.listdir(tmpdir) if f.endswith(".vtt")), None)
                
        if not vtt_file:
            logger.warning(f"No VTT file downloaded for language {lang_code}")
            return None
            
        full_path = os.path.join(tmpdir, vtt_file)
        parsed_data = []
        
        try:
            for caption in webvtt.read(full_path):
                text_clean = caption.text.replace('\n', ' ').strip()
                
                if not text_clean:
                    continue
                    
                start_sec = caption.start_in_seconds
                end_sec = caption.end_in_seconds
                duration = end_sec - start_sec
                
                parsed_data.append({
                    "start": round(start_sec, 3),
                    "duration": round(duration, 3),
                    "text": text_clean
                })
        except Exception as e:
            logger.error(f'Failed to parse VTT file: {e}')
            return None
            
        return parsed_data


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
                'end': round(entry['start'] + entry['duration'], 3),
                'text': entry['text'],
            }
            for idx, entry in enumerate(track.content_json)
        ]

    return []
