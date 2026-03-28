"""API routes — AJAX endpoints for subtitles, notes, etc."""

import os
import tempfile
import webvtt
import re
import difflib
from datetime import datetime, timezone, date, timedelta

from werkzeug.utils import secure_filename

from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user

import yt_dlp
from deep_translator import GoogleTranslator
import pykakasi


from ..extensions import db
from ..models.user import User
from ..models.lesson import Lesson
from ..models.video import Video
from ..models.note import Note
from ..models.subtitle import SubtitleTrack
from ..services.subtitle_service import get_subtitle_track, get_lines_as_dicts

api_bp = Blueprint('api', __name__)

kks = pykakasi.kakasi()

def clean_jp_text(text):
    # Xóa toàn bộ khoảng trắng, tab, xuống dòng và các dấu câu phổ biến
    return re.sub(r'[ \s\t\n.,!?。、！？「」『』（）()\[\]\-]', '', text)

def get_japanese_segments(text):
    # Step 1: Remove punctuation but KEEP English/Numbers
    text = re.sub(r'[\s.,!?。、！？！]', ' ', text)
    result = kks.convert(text)
    
    hira_only = []
    all_segments = []
    
    for item in result:
        h = item['hira'].strip()
        o = item['orig'].strip()
        if not o: continue
        
        # If the origin has English/Numbers, treat as English segment
        if re.search(r'[a-zA-Z0-9]', o):
            all_segments.append(o)
        else:
            # It's Japanese (Kanji/Kana)
            all_segments.append(h)
            hira_only.append(h)
    
    return hira_only, all_segments


@api_bp.route('/score-pronunciation', methods=['POST'])
@login_required
def score_pronunciation():
    data = request.get_json() or {}
    original = data.get('original_text', '')
    spoken = data.get('spoken_text', '')
    lang = data.get('lang_code', 'en')
    
    if lang == 'ja':
        # Chỉ giữ lại tiếng Nhật (Hiragana, Katakana, Kanji)
        # Các từ tiếng Anh/Dấu câu sẽ bị loại bỏ khỏi cả 2 chuỗi để không tính vào tỷ lệ lệ
        def clean_jp_only(text):
            return re.sub(r'[^\u3040-\u30FF\u4E00-\u9FFF]', '', text)

        orig_clean = clean_jp_only(original)
        spoken_clean = clean_jp_only(spoken)

        # Nếu câu gốc toàn tiếng Anh (sau khi clean bị rỗng) -> Auto Pass
        if len(orig_clean) == 0:
            return jsonify({"score": 100, "original_text": original})

        # HỆ THỐNG 1: Đếm số ký tự khớp trực tiếp (Raw Match)
        raw_matcher = difflib.SequenceMatcher(None, orig_clean, spoken_clean)
        # Chỉ đếm số ký tự TRÚNG, không quan tâm spoken_clean bị dài bao nhiêu (không phạt chữ thừa)
        raw_matches = sum(block.size for block in raw_matcher.get_matching_blocks())
        raw_score = raw_matches / len(orig_clean) 

        # HỆ THỐNG 2: Đếm số ký tự khớp bằng Hiragana (Cứu cánh cho Kanji)
        orig_hira = "".join([item['hira'] for item in kks.convert(orig_clean)])
        spoken_hira = "".join([item['hira'] for item in kks.convert(spoken_clean)])

        hira_matcher = difflib.SequenceMatcher(None, orig_hira, spoken_hira)
        hira_matches = sum(block.size for block in hira_matcher.get_matching_blocks())
        hira_score = hira_matches / len(orig_hira) if len(orig_hira) > 0 else 1.0

        # CHỐT ĐIỂM: Lấy hệ thống nào điểm cao hơn, tối đa là 100%
        final_score = min(100, int(max(raw_score, hira_score) * 100))

        # DEBUG logging for server console
        print(f"\n[DEBUG-ShadowAI] Gốc (Clean): '{orig_clean}' (Len: {len(orig_clean)})")
        print(f"[DEBUG-ShadowAI] Đọc (Clean): '{spoken_clean}'")
        print(f"[DEBUG-ShadowAI] => ĐIỂM: {final_score}% (Không phạt chữ thừa)\n")

        # For visual guides in UI
        _, orig_full = get_japanese_segments(original)
        _, spoken_full = get_japanese_segments(spoken)

        return jsonify({
            "score": final_score,
            "original_text": original,
            "original_hira": " ".join(orig_full),
            "spoken_hira": " ".join(spoken_full),
            "debug": {"raw_score": int(raw_score*100), "hira_score": int(hira_score*100)}
        })
    else:
        # Simple word-based match fallback for other languages
        orig_words = re.findall(r'\w+', original.lower())
        spoken_words = re.findall(r'\w+', spoken.lower())
        if not orig_words: return jsonify({'score': 100})
        
        match_count = sum(1 for w in spoken_words if w in orig_words)
        score = (match_count / len(orig_words)) * 100
        return jsonify({'score': min(100, int(score))})



@api_bp.route('/translate', methods=['POST'])
@login_required
def translate():
    """Proxy translation requests through server to avoid CORS/IP blocks."""
    try:
        data = request.get_json() or {}
        text = data.get('text', '').strip()
        target_lang = data.get('target_lang', 'vi').strip()
        source_lang = data.get('source_lang', 'auto').strip()

        if not text:
            return jsonify({'error': 'text is required'}), 400

        # Run translation
        translator = GoogleTranslator(source=source_lang, target=target_lang)
        translated = translator.translate(text)

        return jsonify({
            'original': text,
            'translated': translated,
            'target_lang': target_lang
        })
    except Exception as e:
        print(f"[API ERROR] Translation failed: {str(e)}")
        return jsonify({'error': str(e), 'translated': None}), 500

@api_bp.route('/lesson/<int:lesson_id>/track-time', methods=['POST'])
@login_required
def track_time(lesson_id):
    """Update time spent on a lesson and handle Streak logic."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    data = request.get_json() or {}
    seconds = data.get('seconds_added', 0)

    # 1. Update Lesson stats
    lesson.time_spent += int(seconds)
    lesson.last_accessed = datetime.now(timezone.utc)

    # 2. Gamification: Study Streak
    user = current_user
    today = date.today()
    
    if seconds > 0: # Only count if they actually studied
        if user.last_study_date is None:
            # First time ever
            user.current_streak = 1
            user.last_study_date = today
        else:
            if user.last_study_date == today:
                # Already studied today, do nothing to streak
                pass
            elif user.last_study_date == today - timedelta(days=1):
                # Studied yesterday! Increase streak
                user.current_streak += 1
                user.last_study_date = today
            else:
                # Gap in study, reset streak to 1
                user.current_streak = 1
                user.last_study_date = today
        
        # Update longest streak
        cur = user.current_streak or 0
        lng = user.longest_streak or 0
        if cur > lng:
            user.longest_streak = cur

    db.session.commit()
    return jsonify({
        'success': True, 
        'current_streak': user.current_streak or 0,
        'longest_streak': user.longest_streak or 0
    })


@api_bp.route('/video/status/<int:video_id>', methods=['GET'])
@login_required
def get_video_status(video_id):
    """Check background processing status of a video."""
    video = Video.query.get_or_404(video_id)
    return jsonify({
        'id': video.id,
        'youtube_id': video.youtube_id,
        'title': video.title,
        'status': video.status or 'unknown'
    })

@api_bp.route('/subtitles/available/<int:lesson_id>', methods=['GET'])
@login_required
def get_available_subtitles(lesson_id):
    """Return list of subtitles currently uploaded/cached in the DB."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    tracks = SubtitleTrack.query.filter_by(video_id=lesson.video.id).all()
    results = []
    for t in tracks:
        results.append({
            'id': t.id,
            'language_code': t.language_code,
            'is_auto_generated': t.is_auto_generated,
            'uploader_name': t.uploader_name or "Unknown",
            'fetched_at': t.fetched_at.isoformat() if hasattr(t, 'fetched_at') and t.fetched_at else None,
            'line_count': len(t.content_json) if t.content_json else 0
        })
    return jsonify({'subtitles': results})

@api_bp.route('/subtitles/<int:sub_id>', methods=['DELETE'])
@login_required
def delete_subtitle(sub_id):
    """Delete a subtitle track from the DB."""
    track = SubtitleTrack.query.get_or_404(sub_id)
    
    # Optional: Only allow downloader or admin? 
    # For now, if you are studying the lesson, you can manage its video tracks.
    db.session.delete(track)
    db.session.commit()
    return jsonify({'success': True})

@api_bp.route('/youtube/subtitles-list/<video_id>', methods=['GET'])
@login_required
def get_youtube_subs_list(video_id):
    """Fetch available subtitle languages from YouTube using yt-dlp."""
    url = f"https://www.youtube.com/watch?v={video_id}"
    
    # Đảm bảo đường dẫn tuyệt đối cho cookies
    cookie_path = os.path.abspath(os.path.join(os.getcwd(), 'youtube_cookies.txt'))
    if not os.path.exists(cookie_path):
        print(f"[API ERROR] Cookie file not found at: {cookie_path}")
        return jsonify({"error": f"Không tìm thấy file youtube_cookies.txt tại {cookie_path}. Vui lòng kiểm tra lại vị trí file."}), 500

    ydl_opts = {
        'skip_download': True,
        'quiet': True,
        'no_warnings': True,
        'cookiefile': cookie_path, # Kích hoạt bypass bằng cookies
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    }


    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            subs = info.get('subtitles', {})
            autos = info.get('automatic_captions', {})
            
            # Formulate a simplified list
            available = []
            
            # Manual subs
            for code, formats in subs.items():
                available.append({
                    'lang_code': code,
                    'name': formats[0].get('name', code) if formats else code,
                    'is_auto': False
                })
            
            for code, formats in autos.items():
                if any(a['lang_code'] == code for a in available): continue
                available.append({
                    'lang_code': code,
                    'name': (formats[0].get('name', code) if formats else code) + " (Auto)",
                    'is_auto': True
                })
                
            return jsonify({'subtitles': available})
            
    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e)
        if '429' in error_msg or 'Too Many Requests' in error_msg:
            return jsonify({"error": "YouTube đang chặn yêu cầu của máy chủ (Lỗi 429). Vui lòng thử lại sau hoặc Upload file thủ công."}), 429
        return jsonify({"error": f"YouTube Error: {error_msg}"}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/youtube/subtitles-download/<int:lesson_id>', methods=['POST'])
@login_required
def download_youtube_sub(lesson_id):
    """Download subtitle from YouTube, parse, and save to DB."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    data = request.get_json() or {}
    lang_code = data.get('lang_code')
    is_auto = data.get('is_auto', False)
    
    if not lang_code:
        return jsonify({'error': 'lang_code is required'}), 400
        
    v_id = lesson.video.youtube_id
    url = f"https://www.youtube.com/watch?v={v_id}"
    
    # Đảm bảo đường dẫn tuyệt đối cho cookies
    cookie_path = os.path.abspath(os.path.join(os.getcwd(), 'youtube_cookies.txt'))
    if not os.path.exists(cookie_path):
        print(f"[API ERROR] Cookie file not found at: {cookie_path}")
        return jsonify({"error": "Máy chủ thiếu cấu hình youtube_cookies.txt để vượt qua chặn từ YouTube."}), 500

    # yt-dlp options specifically for fetching the vtt
    temp_dir = tempfile.gettempdir()
    ydl_opts = {
        'skip_download': True,
        'writesubtitles': not is_auto,
        'writeautomaticsub': is_auto,
        'subtitleslangs': [lang_code],
        'subtitlesformat': 'vtt',
        'outtmpl': os.path.join(temp_dir, f'sub_%(id)s_%(lang)s'),
        'quiet': True,
        'cookiefile': cookie_path, # Kích hoạt bypass bằng cookies
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    }



    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
            
            target_path = os.path.join(temp_dir, f'sub_{v_id}_{lang_code}.vtt')
            
            if not os.path.exists(target_path):
                import glob
                matches = glob.glob(os.path.join(temp_dir, f'sub_{v_id}_*.vtt'))
                if matches:
                    target_path = matches[0]
                else:
                    return jsonify({'error': 'Failed to find downloaded subtitle file'}), 500

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

            if not parsed_lines:
                return jsonify({'error': 'Parsed lines were empty'}), 500

            track = SubtitleTrack.query.filter_by(video_id=lesson.video.id, language_code=lang_code).first()
            if not track:
                track = SubtitleTrack(video_id=lesson.video.id, language_code=lang_code)
                db.session.add(track)
            
            track.content_json = parsed_lines
            track.is_auto_generated = is_auto
            track.uploader_name = "YouTube"
            track.fetched_at = datetime.now(timezone.utc)
            
            db.session.commit()
            return jsonify({'success': True, 'line_count': len(parsed_lines)})

    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e)
        if '429' in error_msg or 'Too Many Requests' in error_msg:
            return jsonify({"error": "YouTube đang chặn tải tự động (Lỗi 429). Vui lòng tải file vtt về máy và sử dụng Tab 'Upload File' để nộp thủ công."}), 429
        return jsonify({"error": f"Lỗi tải phụ đề: {error_msg}"}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500



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
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        content = f.read()
    
    # Normalize line endings
    content = content.replace('\r\n', '\n')
    blocks = content.split('\n\n')
    entries = []
    
    for block in blocks:
        if not block.strip(): continue
        lines = block.strip().split('\n')
        if len(lines) < 3: continue
        
        # Line 0 is ID, Line 1 is times, Line 2+ is text
        times = lines[1]
        text = " ".join(lines[2:])
        
        # 00:00:01,000 --> 00:00:04,000
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

@api_bp.route('/subtitles/fetch/<int:lesson_id>', methods=['POST'])
@login_required
def fetch_subtitles(lesson_id):
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    data = request.get_json(force=True) or {}
    lang_code = data.get('language_code', '').strip()

    if not lang_code: return jsonify({'error': 'language_code required'}), 400
    track = SubtitleTrack.query.filter_by(video_id=lesson.video.id, language_code=lang_code).first()
    if track:
        # Compatibility fix: Ensure 'end' is present for all lines
        lines = []
        for line in track.content_json:
            if 'end' not in line and 'duration' in line:
                line['end'] = round(line['start'] + line['duration'], 3)
            elif 'end' not in line:
                line['end'] = line['start'] + 2.0 # Fallback
            lines.append(line)
        return jsonify({'language_code': track.language_code, 'lines': lines})
    return jsonify({'error': 'Track not found'}), 404

@api_bp.route('/subtitles/upload/<int:lesson_id>', methods=['POST'])
@login_required
def upload_subtitle(lesson_id):
    """Handle manual subtitle file upload (.srt or .vtt)."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    
    file = request.files.get('file')
    lang_code = request.form.get('language_code')
    uploader_name = request.form.get('name') or current_user.username
    note = request.form.get('note')

    if not file or not lang_code:
        return jsonify({'error': 'File and language_code are required'}), 400

    filename = secure_filename(file.filename)
    ext = os.path.splitext(filename)[1].lower()
    
    temp_fd, temp_path = tempfile.mkstemp(suffix=ext)
    try:
        os.close(temp_fd)
        file.save(temp_path)
        
        parsed_lines = []
        if ext == '.vtt':
            for caption in webvtt.read(temp_path):
                # webvtt returns captions with start, end, text
                # We normalize to 'start', 'end', 'duration', 'text'
                s = caption.start_in_seconds
                e = caption.end_in_seconds
                parsed_lines.append({
                    'start': round(s, 3),
                    'end': round(e, 3),
                    'duration': round(e - s, 3),
                    'text': caption.text.replace('\n', ' ').strip()
                })
        elif ext == '.srt':
            parsed_lines = _parse_srt(temp_path)
        else:
            return jsonify({'error': 'Unsupported file format'}), 400

        if not parsed_lines:
            return jsonify({'error': 'No lines found in file'}), 400

        # Check for existing track
        track = SubtitleTrack.query.filter_by(video_id=lesson.video.id, language_code=lang_code).first()
        if not track:
            track = SubtitleTrack(video_id=lesson.video.id, language_code=lang_code)
            db.session.add(track)

        track.content_json = parsed_lines
        track.uploader_id = current_user.id
        track.uploader_name = uploader_name
        track.note = note
        track.fetched_at = datetime.now(timezone.utc)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'language_code': lang_code,
            'line_count': len(parsed_lines),
            'lines': parsed_lines
        })
    except Exception as e:
        print(f"[API ERROR] Upload failed: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@api_bp.route('/lesson/<int:lesson_id>/set-languages', methods=['POST'])
@login_required
def set_languages(lesson_id):
    """Save user's subtitle selection and UI settings."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    data = request.get_json(force=True) or {}
    
    lesson.original_lang_code = data.get('original_lang_code')
    lesson.target_lang_code = data.get('target_lang_code')
    lesson.third_lang_code = data.get('third_lang_code')
    
    # Save explicit timing settings
    if 'note_appear_before' in data:
        lesson.note_appear_before = float(data.get('note_appear_before'))
    if 'note_duration' in data:
        lesson.note_duration = float(data.get('note_duration'))
    
    # Save shadowing specific settings
    if 'shadowing_extra_time' in data:
        lesson.shadowing_extra_time = float(data.get('shadowing_extra_time'))
    if 'shadowing_hide_subs' in data:
        lesson.shadowing_hide_subs = bool(data.get('shadowing_hide_subs'))

    import json
    if 'settings' in data:
        lesson.settings_json = json.dumps(data.get('settings'))

        
    db.session.commit()

    return jsonify({'success': True})

# Restore Note Routes
@api_bp.route('/lesson/<int:lesson_id>/notes', methods=['GET', 'POST'])
@login_required
def manage_notes(lesson_id):
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    if request.method == 'POST':
        data = request.get_json(force=True) or {}
        note = Note(
            user_id=current_user.id,
            lesson_id=lesson.id,
            timestamp=data.get('timestamp', 0),
            content=data.get('content', '')
        )
        db.session.add(note)

        db.session.commit()
        return jsonify({
            'success': True,
            'note': {
                'id': note.id,
                'timestamp': note.timestamp,
                'content': note.content,
                'created_at': note.created_at.isoformat()
            }
        })
    
    notes = Note.query.filter_by(lesson_id=lesson_id, user_id=current_user.id).order_by(Note.timestamp).all()
    return jsonify({
        'notes': [{
            'id': n.id, 'timestamp': n.timestamp, 'content': n.content, 'created_at': n.created_at.isoformat()
        } for n in notes]
    })

@api_bp.route('/notes/<int:note_id>', methods=['PATCH', 'DELETE'])
@login_required
def note_ops(note_id):
    note = Note.query.filter_by(id=note_id, user_id=current_user.id).first_or_404()
    
    if request.method == 'DELETE':
        db.session.delete(note)
        db.session.commit()
        return jsonify({'success': True})
        
    if request.method == 'PATCH':
        data = request.get_json(force=True) or {}
        if 'content' in data:
            note.content = data.get('content')

        if 'timestamp' in data:
            note.timestamp = data.get('timestamp')
            
        db.session.commit()
        return jsonify({
            'success': True,
            'note': {
                'id': note.id,
                'content': note.content,
                'timestamp': note.timestamp
            }
        })


@api_bp.route('/lesson/<int:lesson_id>/toggle-complete', methods=['POST'])
@login_required
def toggle_complete(lesson_id):
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    lesson.is_completed = not lesson.is_completed
    db.session.commit()
    return jsonify({'is_completed': lesson.is_completed})

