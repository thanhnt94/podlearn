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
    """Fetch video metadata using yt-dlp. Returns None on failure."""
    try:
        import yt_dlp
        from .subtitle_service import _get_ytdlp_opts

        # Reuse the centralized opts (correct cookie path, extractor_args, etc.)
        ydl_opts = _get_ytdlp_opts({
            'skip_download': True,
            'extract_flat': False,
            'socket_timeout': 10,
        })

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(
                f'https://www.youtube.com/watch?v={youtube_id}',
                download=False
            )

        if not info:
            return None

        # Robust extraction of channel and description
        return VideoInfo(
            youtube_id=youtube_id,
            title=info.get('title', 'Untitled'),
            thumbnail_url=info.get('thumbnail', f'https://img.youtube.com/vi/{youtube_id}/hqdefault.jpg'),
            duration_seconds=int(info.get('duration', 0)),
            channel_title=info.get('uploader'),
            channel_id=info.get('uploader_id'),
            description=info.get('description')
        )

    except Exception as e:
        logger.error(f'Failed to fetch video info for {youtube_id}: {e}')
        return None
