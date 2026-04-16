from datetime import datetime, timezone
from ..extensions import db

class Badge(db.Model):
    """Badge definitions with requirements to unlock."""
    __tablename__ = 'badges'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False)
    icon_name = db.Column(db.String(50), nullable=False) # e.g. 'Shield', 'Flame'
    category = db.Column(db.String(50), default='general') # 'streak', 'shadowing', 'time'
    
    # Requirement Logic
    requirement_type = db.Column(db.String(50), nullable=False) # 'streak_days', 'shadow_count', 'total_hours'
    threshold = db.Column(db.Integer, nullable=False)
    
    is_hidden = db.Column(db.Boolean, default=False) # Some badges remain secret until earned
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f'<Badge {self.name} category={self.category}>'


class UserBadge(db.Model):
    """Many-to-Many relationship between User and Badge with the timestamp."""
    __tablename__ = 'user_badges'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    badge_id = db.Column(db.Integer, db.ForeignKey('badges.id'), nullable=False, index=True)
    earned_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = db.relationship('User', backref=db.backref('badges_earned', lazy='dynamic', cascade='all, delete-orphan'))
    badge = db.relationship('Badge', backref=db.backref('earned_by_users', lazy='dynamic', cascade='all, delete-orphan'))

    def __repr__(self):
        return f'<UserBadge user={self.user_id} badge={self.badge_id}>'
