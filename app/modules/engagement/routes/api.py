from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional
import logging

from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.engagement.models import Comment, Badge, UserBadge, ActivityLog
from app.modules.engagement import interface as engagement_interface
from app.modules.study import interface as study_interface
from app.modules.engagement.services.gamification_service import GamificationService
from app.modules.engagement.schemas import (
    CommentResponse, CommentCreate, GamificationStatusResponse,
    UserBadgeInfo, LeaderboardEntry, UserBasicInfo
)
from app.modules.identity.models import User
from app.modules.content.models import Video

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/engagement", tags=["Engagement"])
gamification_router = APIRouter(prefix="/api/gamification", tags=["Gamification"])
shares_router = APIRouter(prefix="/api/shares", tags=["Shares"])

def _resolve_video_id(video_id_or_yt_id: str, db: Session) -> Optional[int]:
    """Resolve a video_id that could be an integer DB id or a YouTube string id."""
    try:
        return int(video_id_or_yt_id)
    except (ValueError, TypeError):
        video = db.query(Video).filter_by(youtube_id=str(video_id_or_yt_id)).first()
        return video.id if video else None

@router.get('/comments/{video_id}', response_model=List[CommentResponse])
def get_video_comments(video_id: str, db: Session = Depends(get_db)):
    """Fetch all comments for a video, including user info."""
    resolved_id = _resolve_video_id(video_id, db)
    if not resolved_id:
        return []
    
    comments = db.query(Comment).filter_by(video_id=resolved_id, parent_id=None).order_by(Comment.created_at.desc()).all()
    
    return [
        CommentResponse(
            id=c.id,
            content=c.content,
            video_timestamp=c.video_timestamp,
            created_at=c.created_at,
            likes=c.likes_count or 0,
            user=UserBasicInfo(
                id=c.user.id,
                username=c.user.username,
                avatar_url=c.user.avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={c.user.username}"
            ),
            replies_count=db.query(Comment).filter_by(parent_id=c.id).count()
        ) for c in comments
    ]

@router.post('/comments/{video_id}')
def post_new_comment(video_id: str, data: CommentCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Post a new comment or reply."""
    resolved_id = _resolve_video_id(video_id, db)
    if not resolved_id:
        raise HTTPException(status_code=404, detail="Video not found")
    
    comment = Comment(
        user_id=current_user.id,
        video_id=resolved_id,
        content=data.content,
        video_timestamp=data.video_timestamp,
        parent_id=data.parent_id
    )
    
    db.add(comment)
    
    # Reward EXP for engagement
    current_user.total_exp = (current_user.total_exp or 0) + 5
    
    db.commit()
    db.refresh(comment)
    
    return {
        "success": True,
        "comment": {
            "id": comment.id,
            "content": comment.content,
            "video_timestamp": comment.video_timestamp,
            "created_at": comment.created_at,
            "user": {
                "id": current_user.id,
                "username": current_user.username,
                "avatar_url": current_user.avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={current_user.username}"
            }
        }
    }

@router.get('/gamification/status')
def get_gamification_status(current_user: User = Depends(get_current_user)):
    """Detailed gamification status for the user."""
    # Note: engagement_interface.get_user_badges_dto might need db session if it doesn't create one
    badges = engagement_interface.get_user_badges_dto(current_user.id)
    
    return {
        "streak": {
            "current": current_user.current_streak or 0,
            "longest": current_user.longest_streak or 0,
            "last_study_date": current_user.last_study_date
        },
        "progression": {
            "exp": current_user.total_exp or 0,
            "level": (current_user.total_exp or 0) // 100 + 1,
            "next_level_exp": (((current_user.total_exp or 0) // 100) + 1) * 100
        },
        "badges": badges
    }

@router.get('/gamification/badges', response_model=List[UserBadgeInfo])
def list_available_badges(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all badges and user progress towards them."""
    badges = db.query(Badge).all()
    earned_ids = {ub.badge_id for ub in current_user.badges_earned}
    
    return [
        UserBadgeInfo(
            id=b.id,
            name=b.name,
            description=b.description,
            icon=b.icon_name,
            is_earned=b.id in earned_ids,
            requirement_type=b.requirement_type,
            threshold=b.threshold
        ) for b in badges
    ]

@router.get('/gamification/leaderboard', response_model=List[LeaderboardEntry])
def get_leaderboard(db: Session = Depends(get_db)):
    """Global leaderboard based on total EXP."""
    top_users = db.query(User).order_by(User.total_exp.desc()).limit(10).all()
    
    return [
        LeaderboardEntry(
            username=u.username,
            exp=u.total_exp or 0,
            streak=u.current_streak or 0,
            avatar=u.avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={u.username}"
        ) for u in top_users
    ]

@gamification_router.get('/badges/check')
def check_new_badges(current_user: User = Depends(get_current_user)):
    """Manual trigger to check and award badges."""
    newly_earned = GamificationService.check_and_award_badges(current_user)
    
    if newly_earned:
        return {
            "new_badge": {
                "id": newly_earned[0].id,
                "name": newly_earned[0].name,
                "description": newly_earned[0].description,
                "icon": newly_earned[0].icon_name
            }
        }
    return {"new_badge": None}

@shares_router.post('/{share_id}/accept')
def accept_share_invite(share_id: int, current_user: User = Depends(get_current_user)):
    """Accept a workspace/video share invite."""
    video_id = engagement_interface.get_video_id_from_share(share_id)
    if not video_id:
        raise HTTPException(status_code=404, detail="Share invite not found")

    success = engagement_interface.accept_share_request(share_id, current_user.id)
    
    if success:
        existing = study_interface.get_lesson_by_video_user_dto(current_user.id, video_id)
        if not existing:
            study_interface.create_lesson(current_user.id, video_id)
            
    return {"success": success}

@shares_router.post('/{share_id}/reject')
def reject_share_invite(share_id: int, current_user: User = Depends(get_current_user)):
    """Reject a workspace/video share invite."""
    success = engagement_interface.reject_share_request(share_id, current_user.id)
    return {"success": success}
