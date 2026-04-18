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
