from app.modules.engagement.models import Badge, Notification, ShareRequest, UserBadge, ActivityLog, ShadowingHistory
from typing import List, Dict, Any, Optional

def get_user_notifications_dto(user_id: int, limit: int = 20) -> List[Dict[str, Any]]:
    notifs = Notification.query.filter_by(user_id=user_id).order_by(Notification.created_at.desc()).limit(limit).all()
    return [{
        'id': n.id,
        'type': n.type,
        'title': n.title,
        'message': n.message,
        'is_read': n.is_read,
        'created_at': n.created_at.isoformat(),
        'link_url': n.link_url
    } for n in notifs]

def get_user_badges_dto(user_id: int) -> List[Dict[str, Any]]:
    from app.modules.identity.models import User
    user = User.query.get(user_id)
    if not user: return []
    
    all_badges = Badge.query.all()
    earned_ids = {ub.badge_id for ub in user.badges_earned}
    
    badges_data = []
    for b in all_badges:
        earned_at = None
        if b.id in earned_ids:
            ub = UserBadge.query.filter_by(user_id=user_id, badge_id=b.id).first()
            earned_at = ub.earned_at.isoformat() if ub else None
            
        if b.is_hidden and not earned_at:
            continue
            
        badges_data.append({
            'id': b.id,
            'name': b.name,
            'description': b.description,
            'icon_name': b.icon_name,
            'category': b.category,
            'threshold': b.threshold,
            'requirement_type': b.requirement_type,
            'is_earned': earned_at is not None,
            'earned_at': earned_at
        })
    return badges_data

def get_pending_shares_dto(user_id: int) -> List[Dict[str, Any]]:
    pending_shares = ShareRequest.query.filter_by(receiver_id=user_id, status='pending').all()
    return [{
        'id': s.id,
        'sender_name': s.sender.username,
        'video_title': s.video.title,
        'created_at': s.created_at.isoformat()
    } for s in pending_shares]

def get_daily_stats_dto(user_id: int, days: int = 7) -> Dict[str, Any]:
    from datetime import datetime, timezone, timedelta
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days-1)
    
    logs = ActivityLog.query.filter(
        ActivityLog.user_id == user_id,
        ActivityLog.created_at >= start_date
    ).all()
    
    daily_data = {}
    for i in range(days):
        d = (start_date + timedelta(days=i)).date().isoformat()
        daily_data[d] = {'listening_seconds': 0, 'shadowing_count': 0}
        
    for log in logs:
        d = log.created_at.date().isoformat()
        if d in daily_data:
            if log.activity_type == 'LISTEN_PODCAST':
                daily_data[d]['listening_seconds'] += (log.duration_seconds or 0)
            elif log.activity_type == 'SHADOWING_PRACTICE':
                daily_data[d]['shadowing_count'] += (log.metric_value or 0)
    return daily_data

def get_stats_summary_dto(user_id: int) -> Dict[str, Any]:
    from datetime import datetime, timezone, timedelta
    from app.core.extensions import db
    from sqlalchemy import func
    
    end_date = datetime.now(timezone.utc)
    start_date_90 = end_date - timedelta(days=90)
    
    logs = ActivityLog.query.filter(
        ActivityLog.user_id == user_id,
        ActivityLog.created_at >= start_date_90
    ).all()
    
    daily_data = {}
    for i in range(91):
        d = (start_date_90 + timedelta(days=i)).date().isoformat()
        daily_data[d] = {'listening_minutes': 0, 'shadowing_count': 0}
        
    hourly_distribution = {str(i): 0 for i in range(24)}
    
    for log in logs:
        d = log.created_at.date().isoformat()
        if d in daily_data:
            if log.activity_type == 'LISTEN_PODCAST':
                daily_data[d]['listening_minutes'] += (log.duration_seconds or 0) / 60.0
            elif log.activity_type == 'SHADOWING_PRACTICE':
                daily_data[d]['shadowing_count'] += (log.metric_value or 0)
        
        h = str(log.created_at.hour)
        if log.activity_type == 'LISTEN_PODCAST':
            hourly_distribution[h] += (log.duration_seconds or 0) / 60.0
            
    total_shadowing_duration = db.session.query(func.sum(ActivityLog.duration_seconds)).filter(
        ActivityLog.user_id == user_id,
        ActivityLog.activity_type == 'SHADOWING_PRACTICE'
    ).scalar() or 0

    return {
        'daily_data': daily_data,
        'hourly_distribution': hourly_distribution,
        'total_shadowing_duration_seconds': total_shadowing_duration
    }

def get_app_setting_dto(key: str, default: Any = None) -> Any:
    from app.modules.engagement.models import AppSetting
    setting = AppSetting.query.filter_by(key=key).first()
    return setting.value if setting else default

def mark_notification_read(notif_id: int, user_id: int) -> bool:
    from app.core.extensions import db
    notif = Notification.query.filter_by(id=notif_id, user_id=user_id).first()
    if notif:
        notif.is_read = True
        db.session.commit()
        return True
    return False

def get_shadowing_stats_for_lesson(lesson_id: int) -> Dict[str, Any]:
    from sqlalchemy import func
    from app.core.extensions import db
    stats = db.session.query(
        ShadowingHistory.start_time,
        func.count(ShadowingHistory.id).label('attempt_count'),
        func.avg(ShadowingHistory.accuracy_score).label('avg_score'),
        func.max(ShadowingHistory.accuracy_score).label('best_score')
    ).filter(
        ShadowingHistory.lesson_id == lesson_id
    ).group_by(
        ShadowingHistory.start_time
    ).all()

    results = {}
    for s in stats:
        results[str(round(float(s.start_time), 3))] = {
            'count': s.attempt_count,
            'avg': int(s.avg_score),
            'best': s.best_score
        }
    return results

def award_badge_async(user_id: int):
    """
    Trigger badge check asynchronously using GamificationService.
    In a true monolith, this might use a signal.
    """
    from app.modules.engagement.services.gamification_service import GamificationService
    from app.modules.identity.models import User
    user = User.query.get(user_id)
    if user:
        return GamificationService.check_and_award_badges(user)
    return []

def accept_share_request(share_id: int, user_id: int) -> bool:
    from app.core.extensions import db
    share = ShareRequest.query.filter_by(id=share_id, receiver_id=user_id, status='pending').first()
    if not share:
        return False
    share.status = 'accepted'
    db.session.commit()
    return True

def reject_share_request(share_id: int, user_id: int) -> bool:
    from app.core.extensions import db
    share = ShareRequest.query.filter_by(id=share_id, receiver_id=user_id, status='pending').first()
    if not share:
        return False
    share.status = 'rejected'
    db.session.commit()
    return True

def get_video_id_from_share(share_id: int) -> Optional[int]:
    share = ShareRequest.query.get(share_id)
    return share.video_id if share else None

def get_user_stats_dto(user_id: int) -> Dict[str, Any]:
    from app.modules.identity.models import User
    user = User.query.get(user_id)
    if not user:
        return {
            'current_streak': 0,
            'longest_streak': 0,
            'completed_count': 0,
            'total_exp': 0,
            'total_listening_seconds': 0,
            'total_shadowing_count': 0
        }
    
    return {
        'current_streak': user.current_streak or 0,
        'longest_streak': user.longest_streak or 0,
        'completed_count': getattr(user, 'completed_count', 0), # Fallback if not on model yet
        'total_exp': user.total_exp or 0,
        'total_listening_seconds': user.total_listening_seconds or 0,
        'total_shadowing_count': user.total_shadowing_count or 0
    }
