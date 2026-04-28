"""YouTube metadata service — fetch video info from a URL using yt-dlp."""

import re
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Regex patterns for YouTube video IDs
YT_PATTERNS = [
    re.compile(r'(?:youtube\.com/watch\?.*v=|youtu\.be/|youtube\.com/embed/|youtube\.com/shorts/)([a-zA-Z0-9_-]{11})'),
]


@dataclass
class VideoInfo:
    youtube_id: str
    title: str
    thumbnail_url: str
    duration_seconds: int
    channel_title: str | None = None
    channel_id: str | None = None
    description: str | None = None


def extract_video_id(url: str) -> str | None:
    """Extract the 11-character YouTube video ID from various URL formats."""
    url = url.strip()
    # Direct ID (11 chars, no slashes)
    if re.match(r'^[a-zA-Z0-9_-]{11}$', url):
        return url
    for pattern in YT_PATTERNS:
        match = pattern.search(url)
        if match:
            return match.group(1)
    return None


def fetch_video_info(youtube_id: str) -> VideoInfo | None:
    """Fetch video metadata using a resilient Flat-First strategy."""
    try:
        from .subtitle_service import fetch_info_cached
        import sys

        print(f"\n>>> [YT-METADATA] PHASE 1: Fast Flat Extract for {youtube_id}... <<<")
        sys.stdout.flush()

        # Phase 1: Flat Extraction (No stream resolution, very high success rate)
        info = fetch_info_cached(youtube_id, extra_opts={
            'extract_flat': True,
            'socket_timeout': 10,
        })

        if not info or 'title' not in info:
            print(f">>> [YT-METADATA] PHASE 2: Fallback to Full Extract... <<<")
            sys.stdout.flush()
            info = fetch_info_cached(youtube_id, extra_opts={
                'extract_flat': False,
                'socket_timeout': 15,
            })

        if not info:
            print(f">>> [YT-METADATA] FATAL: No metadata found for {youtube_id} <<<")
            return None

        # Robust extraction of fields, providing fallbacks for restricted videos
        v_info = VideoInfo(
            youtube_id=youtube_id,
            title=info.get('title') or info.get('id') or "Restricted Video",
            thumbnail_url=info.get('thumbnail') or f'https://img.youtube.com/vi/{youtube_id}/hqdefault.jpg',
            duration_seconds=int(info.get('duration') or 0),
            channel_title=info.get('uploader') or info.get('channel') or "Unknown Channel",
            channel_id=info.get('uploader_id') or info.get('channel_id'),
            description=info.get('description') or "No description available."
        )
        
        print(f">>> [YT-METADATA] SUCCESS: '{v_info.title}' extracted (Flat={info.get('_type') == 'url_composite' or 'formats' not in info}) <<<")
        sys.stdout.flush()
        return v_info

    except Exception as e:
        print(f">>> [YT-METADATA] CRITICAL ERROR for {youtube_id}: {str(e)} <<<")
        sys.stdout.flush()
        logger.error(f'Failed to fetch video info for {youtube_id}: {e}')
        return None
