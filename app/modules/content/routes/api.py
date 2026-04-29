from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from app.extensions import db
from ..models import Video

bp = Blueprint('content_api', __name__)

@bp.route('/curated/<video_id>', methods=['GET'])
def get_curated_content(video_id):
    # Try by youtube_id first, then numeric id if it's an integer
    video = Video.query.filter_by(youtube_id=video_id).first()
    if not video and video_id.isdigit():
        video = Video.query.get(int(video_id))
        
    if not video:
        return jsonify({"error": "Video not found"}), 404

    return jsonify({
        "overview": video.curated_overview or "",
        "grammar": video.curated_grammar or "",
        "vocabulary": video.curated_vocabulary or ""
    })

@bp.route('/curated/<video_id>', methods=['PATCH'])
@login_required
def update_curated_content(video_id):
    if not current_user.is_admin:
        return jsonify({"error": "Admin access required"}), 403
    
    video = Video.query.filter_by(youtube_id=video_id).first()
    if not video and video_id.isdigit():
        video = Video.query.get(int(video_id))

    if not video:
        return jsonify({"error": "Video not found"}), 404

    data = request.get_json() or {}
    
    if 'overview' in data:
        video.curated_overview = data['overview']
    if 'grammar' in data:
        video.curated_grammar = data['grammar']
    if 'vocabulary' in data:
        video.curated_vocabulary = data['vocabulary']
        
    db.session.commit()
    return jsonify({"success": True})

@bp.route('/health', methods=['GET'])
def health():
    return {"status": "ok", "module": "content"}
