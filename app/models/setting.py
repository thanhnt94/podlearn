import json
from datetime import datetime, timezone
from ..extensions import db

class AppSetting(db.Model):
    """
    Dynamic application settings stored in the database.
    Allows changing system behavior (like SSO toggle) without code changes.
    """
    __tablename__ = 'app_settings'

    key = db.Column(db.String(100), primary_key=True)
    value = db.Column(db.JSON, nullable=False)
    category = db.Column(db.String(50), default='general')
    data_type = db.Column(db.String(50), default='string') # string, bool, int, json
    description = db.Column(db.Text, nullable=True)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    @staticmethod
    def get(key, default=None):
        setting = AppSetting.query.get(key)
        if not setting:
            return default
        return setting.value

    @staticmethod
    def set(key, value, category='general', data_type='string', description=None):
        setting = AppSetting.query.get(key)
        if not setting:
            setting = AppSetting(key=key, category=category, data_type=data_type, description=description)
            db.session.add(setting)
        
        setting.value = value
        if description:
            setting.description = description
        db.session.commit()
        return setting
