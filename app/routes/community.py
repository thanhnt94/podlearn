from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from ..extensions import db
from app.modules.engagement.models import Comment
from app.modules.identity.models import User

community_bp = Blueprint('community', __name__)

@community_bp.route('/comments/<int:video_id>', methods=['GET'])
def get_comments(video_id):
    """Fetch comments for a video, ordered by timestamp then creation."""
    comments = Comment.query.filter_by(video_id=video_id).order_by(Comment.video_timestamp.asc(), Comment.created_at.desc()).all()
    
    result = []
    for c in comments:
        result.append({
            'id': c.id,
            'content': c.content,
            'video_timestamp': c.video_timestamp,
            'created_at': c.created_at.isoformat(),
            'user': {
                'id': c.user.id,
                'username': c.user.username,
                'avatar_url': c.user.avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={c.user.username}"
            }
        })
    
    return jsonify(result)

@community_bp.route('/comments/<int:video_id>', methods=['POST'])
@login_required
def post_comment(video_id):
    """Post a new comment for a video."""
    data = request.get_json() or {}
    content = data.get('content')
    video_timestamp = data.get('video_timestamp')

    if not content:
        return jsonify({"error": "Content is required"}), 400

    comment = Comment(
        user_id=current_user.id,
        video_id=video_id,
        content=content,
        video_timestamp=float(video_timestamp) if video_timestamp is not None else None
    )

    db.session.add(comment)
    db.session.commit()

    return jsonify({
        'success': True,
        'comment': {
            'id': comment.id,
            'content': comment.content,
            'video_timestamp': comment.video_timestamp,
            'user': {
                'id': current_user.id,
                'username': current_user.username,
                'avatar_url': current_user.avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={current_user.username}"
            }
        }
    })
