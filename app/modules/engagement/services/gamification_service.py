from datetime import datetime, date, timezone, timedelta
from app.extensions import db
from app.modules.engagement.models import Badge, UserBadge
from app.modules.engagement.models import Notification
from app.modules.identity.models import User
from app.modules.engagement.models import ActivityLog

class GamificationService:
    @staticmethod
    def seed_default_badges():
        """Initialize standard badges if they don't exist."""
        defaults = [
            # Streak Badges
            {'name': 'Early Bird', 'desc': 'Completed your first lesson.', 'icon': 'Bird', 'type': 'total_lessons', 'thresh': 1, 'cat': 'streak'},
            {'name': 'Consistent Learner', 'desc': 'Maintained a 3-day streak.', 'icon': 'Flame', 'type': 'streak_days', 'thresh': 3, 'cat': 'streak'},
            {'name': 'Streak Warrior', 'desc': 'Maintained a 7-day streak.', 'icon': 'ShieldCheck', 'type': 'streak_days', 'thresh': 7, 'cat': 'streak'},
            {'name': 'Unstoppable', 'desc': 'Maintained a 30-day streak.', 'icon': 'Trophy', 'type': 'streak_days', 'thresh': 30, 'cat': 'streak'},
            
            # Shadowing Badges
            {'name': 'Echo Novice', 'desc': 'Shadowed 50 sentences.', 'icon': 'Mic2', 'type': 'shadow_count', 'thresh': 50, 'cat': 'shadowing'},
            {'name': 'Speak Like a Native', 'desc': 'Shadowed 500 sentences.', 'icon': 'Zap', 'type': 'shadow_count', 'thresh': 500, 'cat': 'shadowing'},
            
            # Time Badges
            {'name': 'Dedicated', 'desc': 'Spent 5 hours listening.', 'icon': 'Clock', 'type': 'total_hours', 'thresh': 5, 'cat': 'time'},
            {'name': 'Immersion Master', 'desc': 'Spent 50 hours listening.', 'icon': 'Crown', 'type': 'total_hours', 'thresh': 50, 'cat': 'time'},
        ]
        
        for b in defaults:
            exists = Badge.query.filter_by(name=b['name']).first()
            if not exists:
                badge = Badge(
                    name=b['name'],
                    description=b['desc'],
                    icon_name=b['icon'],
                    requirement_type=b['type'],
                    threshold=b['thresh'],
                    category=b['cat']
                )
                db.session.add(badge)
        db.session.commit()

    @staticmethod
    def check_and_award_badges(user):
        """Check user progress and award missing badges."""
        available_badges = Badge.query.all()
        earned_badge_ids = {ub.badge_id for ub in user.badges_earned}
        
        new_badges = []
        
        # Current stats
        stats = {
            'streak_days': user.current_streak or 0,
            'shadow_count': user.total_shadowing_count or 0,
            'total_hours': (user.total_listening_seconds or 0) / 3600,
            'total_lessons': user.lessons.filter_by(is_completed=True).count()
        }
        
        for badge in available_badges:
            if badge.id in earned_badge_ids:
                continue
                
            current_val = stats.get(badge.requirement_type, 0)
            if current_val >= badge.threshold:
                # Award badge!
                ub = UserBadge(user_id=user.id, badge_id=badge.id)
                db.session.add(ub)
                
                # Create Notification
                notif = Notification(
                    user_id=user.id,
                    type='ACHIEVEMENT',
                    title='🎉 Danh hiệu mới!',
                    message=f'Chúc mừng! Bạn đã đạt được danh hiệu "{badge.name}": {badge.description}',
                    link_url='/achievements'
                )
                db.session.add(notif)
                new_badges.append(badge)
        
        if new_badges:
            db.session.commit()
            
        return new_badges

    @staticmethod
    def generate_streak_reminders():
        """Find users whose streak is about to expire and notify them."""
        # Find users who haven't studied today and have a streak > 0
        today = date.today()
        # Users who studied yesterday but not today
        yesterday = today - timedelta(days=1)
        
        users_at_risk = User.query.filter(
            User.current_streak > 0,
            (User.last_study_date == yesterday) | (User.last_study_date == None)
        ).all()
        
        reminders_sent = 0
        for user in users_at_risk:
            # Check if reminder already sent today
            exists = Notification.query.filter(
                Notification.user_id == user.id,
                Notification.type == 'STREAK_REMINDER',
                db.func.date(Notification.created_at) == today
            ).first()
            
            if not exists:
                notif = Notification(
                    user_id=user.id,
                    type='STREAK_REMINDER',
                    title='🔥 Giữ vững ngọn lửa!',
                    message=f'Đừng để chuỗi {user.current_streak} ngày học của bạn biến mất. Hãy dành 5 phút luyện tập hôm nay nhé!',
                    link_url='/dashboard'
                )
                db.session.add(notif)
                reminders_sent += 1
        
        db.session.commit()
        return reminders_sent
