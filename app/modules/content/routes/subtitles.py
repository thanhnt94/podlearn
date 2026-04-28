from flask import Blueprint, jsonify, request, Response
from flask_login import login_required, current_user
from app.extensions import db
from ..models import SubtitleTrack, Video
from ..services import subtitle_service
from sqlalchemy.orm.attributes import flag_modified

bp = Blueprint('content_subtitles', __name__)

def vip_required(f):
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_vip:
            return jsonify({"error": "VIP account required"}), 403
        return f(*args, **kwargs)
    return decorated_function

@bp.route('/video/<int:video_id>', methods=['GET'])
def list_tracks(video_id):
    """List all subtitle tracks for a video."""
    tracks = SubtitleTrack.query.filter_by(video_id=video_id).all()
    return jsonify([{
        'id': t.id,
        'language_code': t.language_code,
        'name': t.name or f"{t.language_code.upper()}_Original",
        'is_original': t.is_original,
        'is_auto': t.is_auto_generated,
        'status': t.status,
        'progress': t.progress,
        'total_lines': t.total_lines,
        'uploader_name': t.uploader_name
    } for t in tracks])

@bp.route('/status/<int:track_id>', methods=['GET'])
def get_track_status(track_id):
    """Check status and progress of a track."""
    track = SubtitleTrack.query.get_or_404(track_id)
    return jsonify({
        'id': track.id,
        'status': track.status,
        'progress': track.progress,
        'total_lines': track.total_lines
    })

@bp.route('/<int:track_id>/translate', methods=['POST'])
@login_required
@vip_required
def translate_track(track_id):
    """Translate an existing track to a new language."""
    source_track = SubtitleTrack.query.get_or_404(track_id)
    data = request.get_json() or {}
    target_lang = data.get('target_lang', 'vi')
    
    base_name = data.get('name', f"Bản dịch {target_lang.upper()}")
    unique_name = subtitle_service.generate_unique_track_name(source_track.video_id, base_name)

    try:
        # Create a "Translating" placeholder track
        new_track = SubtitleTrack(
            video_id=source_track.video_id,
            language_code=target_lang,
            name=unique_name,
            is_original=False,
            is_auto_generated=False,
            status='translating',
            uploader_id=current_user.id,
            uploader_name=current_user.username,
            content_json=source_track.content_json # Seed with original for structure
        )
        
        db.session.add(new_track)
        db.session.commit()
        
        # Trigger background translation
        subtitle_service.translate_track_content(
            new_track.id, 
            target_lang=target_lang,
            source_lang=source_track.language_code
        )
        
        return jsonify({
            'success': True, 
            'track_id': new_track.id,
            'message': f'Đang tiến hành dịch sang {target_lang}...'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/<int:track_id>/export', methods=['GET'])
def export_track(track_id):
    """Export track as SRT or VTT."""
    track = SubtitleTrack.query.get_or_404(track_id)
    format = request.args.get('format', 'srt').lower()
    
    content = subtitle_service.export_track_to_string(track, format)
    filename = f"sub_{track.video_id}_{track.language_code}.{format}"
    
    return Response(
        content,
        mimetype="text/plain",
        headers={"Content-disposition": f"attachment; filename={filename}"}
    )

@bp.route('/<int:track_id>', methods=['PATCH'])
@login_required
def update_track_meta(track_id):
    """Update track name or other metadata."""
    track = SubtitleTrack.query.get_or_404(track_id)
    data = request.get_json() or {}
    
    if track.is_original and not current_user.is_admin:
        return jsonify({'error': 'Chỉ Admin mới có thể sửa bản gốc'}), 403
        
    if 'name' in data:
        track.name = data['name']
    
    db.session.commit()
    return jsonify({'success': True})

# --- MOVED FROM LEGACY API ---

@bp.route('/<int:track_id>/line/<int:line_index>', methods=['PATCH'])
@login_required
@vip_required
def edit_line(track_id, line_index):
    track = SubtitleTrack.query.get_or_404(track_id)
    if track.is_original and not current_user.is_admin:
        return jsonify({'error': 'Chỉ Admin mới có thể sửa bản gốc'}), 403
        
    data = request.get_json() or {}
    lines = list(track.content_json)
    if line_index < 0 or line_index >= len(lines):
        return jsonify({'error': 'Index out of bounds'}), 400
        
    line = dict(lines[line_index])
    if 'text' in data: line['text'] = data['text'].strip()
    if 'start' in data: line['start'] = float(data['start'])
    if 'end' in data: line['end'] = float(data['end'])
    
    lines[line_index] = line
    track.content_json = lines
    flag_modified(track, 'content_json')
    db.session.commit()
    return jsonify({'success': True, 'line': line})

@bp.route('/<int:track_id>/shift', methods=['POST'])
@login_required
@vip_required
def shift_track(track_id):
    track = SubtitleTrack.query.get_or_404(track_id)
    if track.is_original and not current_user.is_admin:
        return jsonify({'error': 'Chỉ Admin mới có thể sửa bản gốc'}), 403
        
    data = request.get_json() or {}
    offset = float(data.get('offset', 0))
    
    lines = []
    for line in track.content_json:
        nl = dict(line)
        nl['start'] = max(0, float(nl.get('start', 0)) + offset)
        nl['end'] = max(0, float(nl.get('end', 0)) + offset)
        lines.append(nl)
        
    track.content_json = lines
    flag_modified(track, 'content_json')
    db.session.commit()
    return jsonify({'success': True, 'message': f'Shifted by {offset}s'})

@bp.route('/<int:track_id>/line/<int:line_index>/split', methods=['POST'])
@login_required
@vip_required
def split_line(track_id, line_index):
    track = SubtitleTrack.query.get_or_404(track_id)
    if track.is_original and not current_user.is_admin:
        return jsonify({'error': 'Chỉ Admin mới có thể sửa bản gốc'}), 403
        
    data = request.get_json() or {}
    split_time = float(data.get('time', 0))
    lines = list(track.content_json)
    
    line = lines[line_index]
    line1 = {**line, 'end': split_time}
    line2 = {**line, 'start': split_time, 'text': ''}
    
    lines[line_index] = line1
    lines.insert(line_index + 1, line2)
    
    track.content_json = lines
    flag_modified(track, 'content_json')
    db.session.commit()
    return jsonify({'success': True, 'lines': lines})

@bp.route('/<int:track_id>/line/<int:line_index>/merge', methods=['POST'])
@login_required
@vip_required
def merge_line(track_id, line_index):
    track = SubtitleTrack.query.get_or_404(track_id)
    if track.is_original and not current_user.is_admin:
        return jsonify({'error': 'Chỉ Admin mới có thể sửa bản gốc'}), 403
        
    lines = list(track.content_json)
    line1 = lines[line_index]
    line2 = lines[line_index + 1]
    
    merged = { 'start': line1['start'], 'end': line2['end'], 'text': f"{line1['text']} {line2['text']}".strip() }
    lines[line_index] = merged
    lines.pop(line_index + 1)
    
    track.content_json = lines
    flag_modified(track, 'content_json')
    db.session.commit()
    return jsonify({'success': True, 'lines': lines})
