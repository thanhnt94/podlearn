from datetime import datetime, date, timezone, timedelta
from typing import List, Any
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.modules.engagement.models import Badge, UserBadge, Notification, ActivityLog
from app.modules.identity.models import User
import logging

logger = logging.getLogger(__name__)

class GamificationService:
    @staticmethod
    def seed_default_badges():
        """Initialize standard badges if they don't exist."""
        defaults = [
            {'name': 'Early Bird', 'desc': 'Completed your first lesson.', 'icon': 'Bird', 'type': 'total_lessons', 'thresh': 1, 'cat': 'streak'},
            {'name': 'Consistent Learner', 'desc': 'Maintained a 3-day streak.', 'icon': 'Flame', 'type': 'streak_days', 'thresh': 3, 'cat': 'streak'},
            {'name': 'Streak Warrior', 'desc': 'Maintained a 7-day streak.', 'icon': 'ShieldCheck', 'type': 'streak_days', 'thresh': 7, 'cat': 'streak'},
            {'name': 'Unstoppable', 'desc': 'Maintained a 30-day streak.', 'icon': 'Trophy', 'type': 'streak_days', 'thresh': 30, 'cat': 'streak'},
            {'name': 'Echo Novice', 'desc': 'Shadowed 50 sentences.', 'icon': 'Mic2', 'type': 'shadow_count', 'thresh': 50, 'cat': 'shadowing'},
            {'name': 'Speak Like a Native', 'desc': 'Shadowed 500 sentences.', 'icon': 'Zap', 'type': 'shadow_count', 'thresh': 500, 'cat': 'shadowing'},
            {'name': 'Dedicated', 'desc': 'Spent 5 hours listening.', 'icon': 'Clock', 'type': 'total_hours', 'thresh': 5, 'cat': 'time'},
            {'name': 'Immersion Master', 'desc': 'Spent 50 hours listening.', 'icon': 'Crown', 'type': 'total_hours', 'thresh': 50, 'cat': 'time'},
        ]
        
        with SessionLocal() as db:
            for b in defaults:
                try:
                    exists = db.query(Badge).filter_by(name=b['name']).first()
                    if not exists:
                        badge = Badge(
                            name=b['name'],
                            description=b['desc'],
                            icon_name=b['icon'],
                            requirement_type=b['type'],
                            threshold=b['thresh'],
                            category=b['cat']
                        )
                        db.add(badge)
                        db.commit()
                except Exception as e:
                    db.rollback()
                    logger.error(f"Failed to seed badge {b['name']}: {e}")

    @staticmethod
    def check_and_award_badges(user: User, db: Session = None):
        """Check user progress and award missing badges."""
        if db is None:
            with SessionLocal() as session:
                return GamificationService._check_internal(user, session)
        return GamificationService._check_internal(user, db)

    @staticmethod
    def _check_internal(user: User, db: Session):
        from app.modules.study.models import Lesson
        available_badges = db.query(Badge).all()
        earned_badge_ids = {ub.badge_id for ub in user.badges_earned}
        
        new_badges = []
        
        # Current stats
        stats = {
            'streak_days': user.current_streak or 0,
            'shadow_count': user.total_shadowing_count or 0,
            'total_hours': (user.total_listening_seconds or 0) / 3600,
            'total_lessons': db.query(Lesson).filter_by(user_id=user.id, is_completed=True).count()
        }
        
        for badge in available_badges:
            if badge.id in earned_badge_ids:
                continue
                
            current_val = stats.get(badge.requirement_type, 0)
            if current_val >= badge.threshold:
                # Award badge!
                ub = UserBadge(user_id=user.id, badge_id=badge.id)
                db.add(ub)
                
                # Create Notification
                notif = Notification(
                    user_id=user.id,
                    type='ACHIEVEMENT',
                    title='🎉 Danh hiệu mới!',
                    message=f'Chúc mừng! Bạn đã đạt được danh hiệu "{badge.name}": {badge.description}',
                    link_url='/achievements'
                )
                db.add(notif)
                new_badges.append(badge)
        
        if new_badges:
            db.commit()
            
        return new_badges

    @staticmethod
    def generate_streak_reminders():
        """Find users whose streak is about to expire and notify them."""
        today = date.today()
        yesterday = today - timedelta(days=1)
        
        with SessionLocal() as db:
            from sqlalchemy import func
            users_at_risk = db.query(User).filter(
                User.current_streak > 0,
                (User.last_study_date == yesterday) | (User.last_study_date == None)
            ).all()
            
            reminders_sent = 0
            for user in users_at_risk:
                exists = db.query(Notification).filter(
                    Notification.user_id == user.id,
                    Notification.type == 'STREAK_REMINDER',
                    func.date(Notification.created_at) == today
                ).first()
                
                if not exists:
                    notif = Notification(
                        user_id=user.id,
                        type='STREAK_REMINDER',
                        title='🔥 Giữ vững ngọn lửa!',
                        message=f'Đừng để chuỗi {user.current_streak} ngày học của bạn biến mất. Hãy dành 5 phút luyện tập hôm nay nhé!',
                        link_url='/dashboard'
                    )
                    db.add(notif)
                    reminders_sent += 1
            
            db.commit()
            return reminders_sent
