from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, current_user
from app.core.extensions import db
from app.modules.engagement.models import Comment, Badge, UserBadge, ActivityLog
from app.modules.engagement import interface as engagement_interface
from app.modules.study import interface as study_interface
from app.modules.engagement.services.gamification_service import GamificationService
import logging

logger = logging.getLogger(__name__)

engagement_api_bp = Blueprint('engagement_api', __name__)
gamification_api_bp = Blueprint('gamification_api', __name__)
shares_api_bp = Blueprint('shares_api', __name__)

# --- Community API (Comments & Discussion) ---

@engagement_api_bp.route('/comments/<int:video_id>', methods=['GET'])
def get_video_comments(video_id):
    """Fetch all comments for a video, including user info."""
    comments = Comment.query.filter_by(video_id=video_id, parent_id=None).order_by(Comment.created_at.desc()).all()
    
    return jsonify([{
        "id": c.id,
        "content": c.content,
        "video_timestamp": c.video_timestamp,
        "created_at": c.created_at.isoformat(),
        "likes": c.likes_count,
        "user": {
            "id": c.user.id,
            "username": c.user.username,
            "avatar_url": c.user.avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={c.user.username}"
        },
        "replies_count": c.replies.count()
    } for c in comments])

@engagement_api_bp.route('/comments/<int:video_id>', methods=['POST'])
@jwt_required()
def post_new_comment(video_id):
    """Post a new comment or reply."""
    data = request.get_json() or {}
    content = data.get('content')
    timestamp = data.get('video_timestamp')
    parent_id = data.get('parent_id')

    if not content:
        return jsonify({"error": "Comment content cannot be empty"}), 400

    comment = Comment(
        user_id=current_user.id,
        video_id=video_id,
        content=content,
        video_timestamp=float(timestamp) if timestamp is not None else None,
        parent_id=parent_id
    )
    
    db.session.add(comment)
    
    # Reward EXP for engagement
    current_user.total_exp = (current_user.total_exp or 0) + 5
    
    db.session.commit()
    
    return jsonify({
        "success": True,
        "comment": {
            "id": comment.id,
            "content": comment.content,
            "created_at": comment.created_at.isoformat()
        }
    }), 201

# --- Gamification API (Streaks, Points, Badges) ---

@engagement_api_bp.route('/gamification/status', methods=['GET'])
@jwt_required()
def get_gamification_status():
    """Detailed gamification status for the user."""
    badges = engagement_interface.get_user_badges_dto(current_user.id)
    
    return jsonify({
        "streak": {
            "current": current_user.current_streak or 0,
            "longest": current_user.longest_streak or 0,
            "last_study_date": current_user.last_study_date.isoformat() if current_user.last_study_date else None
        },
        "progression": {
            "exp": current_user.total_exp or 0,
            "level": (current_user.total_exp or 0) // 100 + 1,
            "next_level_exp": (((current_user.total_exp or 0) // 100) + 1) * 100
        },
        "badges": badges
    })

@engagement_api_bp.route('/gamification/badges', methods=['GET'])
@jwt_required()
def list_available_badges():
    """List all badges and user progress towards them."""
    badges = Badge.query.all()
    earned_ids = {ub.badge_id for ub in current_user.badges_earned}
    
    return jsonify([{
        "id": b.id,
        "name": b.name,
        "description": b.description,
        "icon": b.icon_name,
        "is_earned": b.id in earned_ids,
        "requirement_type": b.requirement_type,
        "threshold": b.threshold
    } for b in badges])

@engagement_api_bp.route('/gamification/leaderboard', methods=['GET'])
def get_leaderboard():
    """Global leaderboard based on total EXP."""
    from app.modules.identity.models import User
    top_users = User.query.order_by(User.total_exp.desc()).limit(10).all()
    
    return jsonify([{
        "username": u.username,
        "exp": u.total_exp or 0,
        "streak": u.current_streak or 0,
        "avatar": u.avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={u.username}"
    } for u in top_users])

@gamification_api_bp.route('/badges/check', methods=['GET'])
@jwt_required()
def check_new_badges():
    """Manual trigger to check and award badges."""
    newly_earned = GamificationService.check_and_award_badges(current_user)
    
    if newly_earned:
        return jsonify({
            "new_badge": {
                "id": newly_earned[0].id,
                "name": newly_earned[0].name,
                "description": newly_earned[0].description,
                "icon": newly_earned[0].icon_name
            }
        })
    return jsonify({"new_badge": None})

# --- Shares/Invites API ---

@shares_api_bp.route('/<int:share_id>/accept', methods=['POST'])
@jwt_required()
def accept_share_invite(share_id):
    """Accept a workspace/video share invite."""
    # 1. Get the video_id from the share request
    video_id = engagement_interface.get_video_id_from_share(share_id)
    if not video_id:
        return jsonify({"success": False, "error": "Share invite not found"}), 404

    # 2. Mark as accepted in engagement module
    success = engagement_interface.accept_share_request(share_id, current_user.id)
    
    if success:
        # 3. Create a lesson in study module if it doesn't exist
        existing = study_interface.get_lesson_by_video_user_dto(current_user.id, video_id)
        if not existing:
            study_interface.create_lesson(current_user.id, video_id)
            
    return jsonify({"success": success})

@shares_api_bp.route('/<int:share_id>/reject', methods=['POST'])
@jwt_required()
def reject_share_invite(share_id):
    """Reject a workspace/video share invite."""
    success = engagement_interface.reject_share_request(share_id, current_user.id)
    return jsonify({"success": success})
