"""Hands-Free V2 Service — Audio-Only Podcast Generator.

Downloads YouTube audio, splits by subtitle timestamps using silence detection,
interleaves Edge TTS translations, and returns a single audio file with a new timeline.
"""

import os
import hashlib
import logging
import tempfile
import time
import threading

from pydub import AudioSegment
from pydub.silence import detect_silence

logger = logging.getLogger(__name__)

# ── Global Task Store ──────────────────────────────────────────
handsfree_tasks = {}


def _get_storage_dir():
    """Get the handsfree audio storage directory."""
    base = os.path.abspath(os.path.join(
        os.path.dirname(__file__), '..', '..', '..', 'Storage', 'PodLearn', 'handsfree'
    ))
    os.makedirs(base, exist_ok=True)
    return base


def _get_cache_dir():
    """Get the general handsfree cache directory."""
    base = os.path.abspath(os.path.join(
        os.path.dirname(__file__), '..', '..', '..', 'Storage', 'PodLearn', 'cache'
    ))
    os.makedirs(base, exist_ok=True)
    return base


def _get_cache_key(video_id: str, track_source: str, lang: str) -> str:
    """Generate a unique cache key for this combination."""
    raw = f"{video_id}|{track_source}|{lang}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def download_youtube_audio(video_id: str, output_dir: str) -> str | None:
    """Download audio from YouTube using yt-dlp. Returns path to WAV file."""
    import yt_dlp
    from .subtitle_service import _get_ytdlp_opts

    output_path = os.path.join(output_dir, f"{video_id}.wav")

    # If already downloaded in this session, reuse
    if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
        logger.info(f"[HandsFree] Reusing cached download: {output_path}")
        return output_path

    url = f"https://www.youtube.com/watch?v={video_id}"

    # Try different format combinations for robustness
    formats_to_try = [
        'bestaudio/best',      # Prefer best audio
        'ba[ext=m4a]/ba/b',    # Common audio formats
        'best'                 # Final fallback: best available (might be video)
    ]

    for fmt in formats_to_try:
        logger.info(f"[HandsFree] Attempting download with format: {fmt}")
        ydl_opts = _get_ytdlp_opts({
            'skip_download': False,
            'format': fmt,
            'outtmpl': os.path.join(output_dir, f"{video_id}.%(ext)s"),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'wav',
                'preferredquality': '192',
            }],
            'quiet': True,
            'no_warnings': True,
        })

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])

            if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
                logger.info(f"[HandsFree] Audio downloaded successfully using format '{fmt}'")
                return output_path
        except Exception as e:
            logger.warning(f"[HandsFree] Download failed with format '{fmt}': {e}")
            # Continue to next format
            continue

    logger.error(f"[HandsFree] All download attempts failed for video {video_id}")
    return None


def find_silence_cut_point(audio: AudioSegment, target_ms: int, 
                           search_window_ms: int = 1500, 
                           min_silence_len: int = 150, 
                           silence_thresh: int = -40) -> int:
    """Find the best silence-based cut point near the target timestamp.
    
    Searches a window around `target_ms` for silence gaps.
    If a silence gap is found, returns the midpoint of the nearest one.
    If no silence is found, returns `target_ms` as fallback.
    
    Args:
        audio: The full audio segment
        target_ms: The ideal cut point in milliseconds
        search_window_ms: How far to search after target_ms
        min_silence_len: Minimum silence duration to detect (ms)
        silence_thresh: Silence threshold in dBFS
    
    Returns:
        The best cut point in milliseconds
    """
    # Define search region: slightly before target to well after
    search_start = max(0, target_ms - 200)
    search_end = min(len(audio), target_ms + search_window_ms)
    
    if search_start >= search_end or search_end > len(audio):
        return target_ms
    
    # Extract the search region
    search_region = audio[search_start:search_end]
    
    # Detect silent regions within the search window
    silences = detect_silence(
        search_region, 
        min_silence_len=min_silence_len, 
        silence_thresh=silence_thresh
    )
    
    if not silences:
        # No silence found — try with a more lenient threshold
        silences = detect_silence(
            search_region, 
            min_silence_len=100, 
            silence_thresh=-35
        )
    
    if not silences:
        # Still nothing — use the target as-is
        return target_ms
    
    # Find the silence gap closest to the target point
    best_cut = target_ms
    best_distance = float('inf')
    
    for silence_start, silence_end in silences:
        # Convert back to absolute timestamps
        abs_start = search_start + silence_start
        abs_end = search_start + silence_end
        
        # Use the midpoint of the silence gap as cut point
        midpoint = (abs_start + abs_end) // 2
        
        # Prefer cuts AFTER the target (to not cut off speech)
        distance = abs(midpoint - target_ms)
        if midpoint >= target_ms - 100:  # Allow slight backward cut
            distance *= 0.5  # Bias toward cuts after target
        
        if distance < best_distance:
            best_distance = distance
            best_cut = midpoint
    
    logger.debug(f"[HandsFree] Cut point: target={target_ms}ms → actual={best_cut}ms (delta={best_cut - target_ms}ms)")
    return best_cut


def build_handsfree_audio(video_id: str, subtitles: list, 
                          translation_lines: list, lang: str,
                          task_id: str = None) -> dict | None:
    """Main pipeline: build a podcast-style audio file.
    
    Args:
        video_id: YouTube video ID
        subtitles: Original subtitle lines [{"start": float, "end": float, "text": str}, ...]
        translation_lines: Translation lines in the same format
        lang: Language code for TTS (e.g. 'vi')
        task_id: Optional task ID for progress tracking
    
    Returns:
        {"audio_url": str, "timeline": list, "total_duration": float} or None
    """
    storage_dir = _get_storage_dir()
    cache_key = _get_cache_key(video_id, 'handsfree', lang)
    
    # Check cache
    cached_mp3 = os.path.join(storage_dir, f"{cache_key}.mp3")
    cached_timeline = os.path.join(storage_dir, f"{cache_key}.json")
    
    if os.path.exists(cached_mp3) and os.path.exists(cached_timeline):
        import json
        with open(cached_timeline, 'r', encoding='utf-8') as f:
            timeline_data = json.load(f)
        logger.info(f"[HandsFree] Cache hit: {cache_key}")
        return {
            "audio_url": f"/media/handsfree/{cache_key}.mp3",
            "timeline": timeline_data['timeline'],
            "total_duration": timeline_data['total_duration']
        }

    def _update_progress(step: str, progress: float):
        if task_id and task_id in handsfree_tasks:
            handsfree_tasks[task_id]['step'] = step
            handsfree_tasks[task_id]['progress'] = progress

    _update_progress('downloading', 0.0)

    # 1. Download YouTube audio
    cache_dir = _get_cache_dir()
    wav_path = download_youtube_audio(video_id, cache_dir)
    if not wav_path:
        logger.error("[HandsFree] Failed to download YouTube audio")
        return None

    _update_progress('loading', 0.1)

    # 2. Load the full audio
    try:
        full_audio = AudioSegment.from_file(wav_path)
    except Exception as e:
        logger.error(f"[HandsFree] Failed to load audio: {e}")
        return None

    _update_progress('processing', 0.15)

    # 3. Build segments
    combined = AudioSegment.empty()
    timeline = []
    silence_gap = AudioSegment.silent(duration=500)  # 0.5s between original and TTS
    segment_gap = AudioSegment.silent(duration=300)   # 0.3s between segments
    
    total_lines = len(subtitles)
    
    for i, sub_line in enumerate(subtitles):
        sub_start_ms = int(sub_line['start'] * 1000)
        sub_end_ms = int(sub_line['end'] * 1000)
        
        # Smart cut points using silence detection
        cut_start = find_silence_cut_point(
            full_audio, 
            max(0, sub_start_ms - 200),  # Search slightly before sub start
            search_window_ms=500
        )
        # For the end, bias toward extending (don't cut off speech)
        cut_end = find_silence_cut_point(
            full_audio, 
            sub_end_ms,
            search_window_ms=1500  # Wider window for end
        )
        
        # Ensure sane bounds
        cut_start = max(0, min(cut_start, len(full_audio)))
        cut_end = max(cut_start + 100, min(cut_end, len(full_audio)))
        
        # Extract original audio segment
        original_segment = full_audio[cut_start:cut_end]
        
        # Find matching translation line
        translation_text = None
        if translation_lines:
            # Match by proximity of start time
            best_match = min(
                translation_lines, 
                key=lambda tl: abs(tl['start'] - sub_line['start']),
                default=None
            )
            if best_match and abs(best_match['start'] - sub_line['start']) < 1.5:
                translation_text = best_match['text']
        
        # Record timeline entry
        entry = {
            "index": i,
            "original_start": len(combined) / 1000.0,
            "text_original": sub_line.get('text', ''),
        }
        
        # Add original audio
        combined += original_segment
        entry["original_end"] = len(combined) / 1000.0
        
        # Add TTS translation if available
        if translation_text:
            combined += silence_gap
            entry["tts_start"] = len(combined) / 1000.0
            entry["text_translation"] = translation_text
            
            # Generate TTS audio
            tts_segment = _generate_tts_segment(translation_text, lang, cache_dir)
            if tts_segment:
                combined += tts_segment
            
            entry["tts_end"] = len(combined) / 1000.0
        else:
            entry["tts_start"] = None
            entry["tts_end"] = None
            entry["text_translation"] = None
        
        # Add gap between segments
        combined += segment_gap
        
        timeline.append(entry)
        
        # Update progress
        progress = 0.15 + (0.80 * (i + 1) / total_lines)
        _update_progress('processing', progress)

    _update_progress('exporting', 0.95)

    # 4. Export final MP3
    try:
        combined.export(cached_mp3, format="mp3", bitrate="192k")
    except Exception as e:
        logger.error(f"[HandsFree] Failed to export MP3: {e}")
        return None

    # 5. Save timeline
    import json
    timeline_data = {
        "timeline": timeline,
        "total_duration": len(combined) / 1000.0,
        "video_id": video_id,
        "lang": lang
    }
    with open(cached_timeline, 'w', encoding='utf-8') as f:
        json.dump(timeline_data, f, ensure_ascii=False, indent=2)

    _update_progress('done', 1.0)

    logger.info(f"[HandsFree] Generated: {cache_key}.mp3 ({len(combined)/1000:.1f}s, {total_lines} segments)")

    return {
        "audio_url": f"/media/handsfree/{cache_key}.mp3",
        "timeline": timeline,
        "total_duration": len(combined) / 1000.0
    }


def _generate_tts_segment(text: str, lang: str, cache_dir: str) -> AudioSegment | None:
    """Generate a TTS audio segment using Edge TTS."""
    import asyncio
    import edge_tts
    
    # Voice mapping (same as tts_service.py)
    VOICE_MAP = {
        'vi': 'vi-VN-HoaiMyNeural',
        'en': 'en-US-JennyNeural',
        'ja': 'ja-JP-NanamiNeural',
        'ko': 'ko-KR-SunHiNeural',
        'zh': 'zh-CN-XiaoxiaoNeural',
        'fr': 'fr-FR-DeniseNeural',
        'de': 'de-DE-KatjaNeural',
        'es': 'es-ES-ElviraNeural',
    }
    
    base_lang = lang.split('-')[0].lower()
    voice = VOICE_MAP.get(base_lang, 'en-US-JennyNeural')
    
    # Hash for temp file uniqueness
    text_hash = hashlib.md5(text.encode()).hexdigest()[:12]
    tts_path = os.path.join(cache_dir, f"tts_{text_hash}.mp3")
    
    if os.path.exists(tts_path) and os.path.getsize(tts_path) > 100:
        return AudioSegment.from_file(tts_path)
    
    try:
        async def _run():
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(tts_path)
        
        # Run async in a new event loop (safe for threads)
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(_run())
        finally:
            loop.close()
        
        if os.path.exists(tts_path) and os.path.getsize(tts_path) > 100:
            return AudioSegment.from_file(tts_path)
        return None
    except Exception as e:
        logger.error(f"[HandsFree] TTS failed for '{text[:30]}...': {e}")
        return None


def start_generation_task(video_id: str, subtitles: list, 
                          translation_lines: list, lang: str) -> str:
    """Start a background generation task. Returns task_id."""
    task_id = f"hf_{hashlib.md5(f'{video_id}{time.time()}'.encode()).hexdigest()[:12]}"
    
    handsfree_tasks[task_id] = {
        'status': 'processing',
        'step': 'queued',
        'progress': 0.0,
        'result': None,
        'error': None
    }
    
    def _worker():
        try:
            result = build_handsfree_audio(video_id, subtitles, translation_lines, lang, task_id)
            if result:
                handsfree_tasks[task_id]['status'] = 'completed'
                handsfree_tasks[task_id]['result'] = result
            else:
                handsfree_tasks[task_id]['status'] = 'failed'
                handsfree_tasks[task_id]['error'] = 'Generation failed'
        except Exception as e:
            logger.error(f"[HandsFree] Task {task_id} failed: {e}")
            handsfree_tasks[task_id]['status'] = 'failed'
            handsfree_tasks[task_id]['error'] = str(e)
    
    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()
    
    return task_id
