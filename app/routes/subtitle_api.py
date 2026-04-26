from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from .admin_api import moderator_required
from ..extensions import db
from ..models.subtitle import SubtitleTrack

subtitle_api_bp = Blueprint('subtitle_api', __name__, url_prefix='/api/subtitles')

@subtitle_api_bp.route('/<int:track_id>/line/<int:line_index>', methods=['PATCH'])
@login_required
@moderator_required
def quick_edit_subtitle_line(track_id, line_index):
    """
    Update a single line's text or timing in a subtitle track.
    Requires at least Moderator role.
    """
    track = SubtitleTrack.query.get_or_404(track_id)
    data = request.get_json() or {}
    
    # Validation
    if not isinstance(track.content_json, list):
        return jsonify({'error': 'Subtitle track content is not a valid list'}), 400
        
    if line_index < 0 or line_index >= len(track.content_json):
        return jsonify({'error': 'Line index out of bounds'}), 400
        
    # Get the line to update
    # We must create a new list or use flag_modified for JSON change detection
    lines = list(track.content_json)
    line = dict(lines[line_index])
    
    # Update fields
    if 'text' in data:
        line['text'] = data['text'].strip()
    if 'start' in data:
        line['start'] = float(data['start'])
    if 'end' in data:
        line['end'] = float(data['end'])
        
    lines[line_index] = line
    
    # Commit changes
    from sqlalchemy.orm.attributes import flag_modified
    track.content_json = lines
    flag_modified(track, 'content_json')
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'Line {line_index} updated successfully.',
        'line': line
    })

@subtitle_api_bp.route('/<int:track_id>/shift', methods=['POST'])
@login_required
@moderator_required
def shift_subtitle_track(track_id):
    """
    Shift all lines in a subtitle track by a given offset in seconds.
    Positive offset shifts later, negative shifts earlier.
    """
    track = SubtitleTrack.query.get_or_404(track_id)
    data = request.get_json() or {}
    offset = float(data.get('offset', 0))
    
    if offset == 0:
        return jsonify({'success': True, 'message': 'Offset is zero, no change.'})
        
    if not isinstance(track.content_json, list):
        return jsonify({'error': 'Subtitle track content is not a valid list'}), 400
        
    lines = []
    for line in track.content_json:
        new_line = dict(line)
        if 'start' in new_line:
            new_line['start'] = max(0, float(new_line['start']) + offset)
        if 'end' in new_line:
            new_line['end'] = max(0, float(new_line['end']) + offset)
        lines.append(new_line)
        
    from sqlalchemy.orm.attributes import flag_modified
    track.content_json = lines
    flag_modified(track, 'content_json')
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'Shifted {len(lines)} lines by {offset}s.',
        'track_id': track_id
    })

@subtitle_api_bp.route('/<int:track_id>/line/<int:line_index>/split', methods=['POST'])
@login_required
@moderator_required
def split_subtitle_line(track_id, line_index):
    track = SubtitleTrack.query.get_or_404(track_id)
    data = request.get_json() or {}
    split_time = float(data.get('time', 0))
    
    lines = list(track.content_json)
    if line_index < 0 or line_index >= len(lines):
        return jsonify({'error': 'Invalid line index'}), 400
        
    line = lines[line_index]
    if not (line['start'] <= split_time <= line['end']):
        split_time = (line['start'] + line['end']) / 2
        
    # Split the line: first part keeps text, second part is empty
    line1 = {**line, 'end': split_time}
    line2 = {**line, 'start': split_time, 'text': ''}
    
    lines[line_index] = line1
    lines.insert(line_index + 1, line2)
    
    from sqlalchemy.orm.attributes import flag_modified
    track.content_json = lines
    flag_modified(track, 'content_json')
    db.session.commit()
    
    return jsonify({'success': True, 'lines': lines})

@subtitle_api_bp.route('/<int:track_id>/line/<int:line_index>/merge', methods=['POST'])
@login_required
@moderator_required
def merge_subtitle_line(track_id, line_index):
    track = SubtitleTrack.query.get_or_404(track_id)
    lines = list(track.content_json)
    
    if line_index < 0 or line_index >= len(lines) - 1:
        return jsonify({'error': 'No next line to merge with'}), 400
        
    line1 = lines[line_index]
    line2 = lines[line_index + 1]
    
    merged_line = {
        'start': line1['start'],
        'end': line2['end'],
        'text': f"{line1['text']} {line2['text']}".strip()
    }
    
    lines[line_index] = merged_line
    lines.pop(line_index + 1)
    
    from sqlalchemy.orm.attributes import flag_modified
    track.content_json = lines
    flag_modified(track, 'content_json')
    db.session.commit()
    
    return jsonify({'success': True, 'lines': lines})

@subtitle_api_bp.route('/<int:track_id>/line/<int:line_index>', methods=['DELETE'])
@login_required
@moderator_required
def delete_subtitle_line(track_id, line_index):
    track = SubtitleTrack.query.get_or_404(track_id)
    lines = list(track.content_json)
    
    if line_index < 0 or line_index >= len(lines):
        return jsonify({'error': 'Invalid line index'}), 400
        
    lines.pop(line_index)
    
    from sqlalchemy.orm.attributes import flag_modified
    track.content_json = lines
    flag_modified(track, 'content_json')
    db.session.commit()
    
    return jsonify({'success': True, 'lines': lines})
