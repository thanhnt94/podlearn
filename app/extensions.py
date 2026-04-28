"""Shared Flask extensions — initialized once, imported everywhere."""

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager

from flask_wtf.csrf import CSRFProtect
from sqlalchemy import MetaData
import redis

naming_convention = {
    "ix": 'ix_%(column_0_label)s',
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

db = SQLAlchemy(metadata=MetaData(naming_convention=naming_convention))
migrate = Migrate(render_as_batch=True)
login_manager = LoginManager()
csrf = CSRFProtect()
redis_client = None # Will be initialized in create_app

# Storage extension placeholder
storage = None

# Redirect unauthenticated users to the login page
login_manager.login_view = 'auth.login'
login_manager.login_message_category = 'info'

def celery_init_app(app):
    # DUMMY implementation to avoid breakage during transition
    pass
