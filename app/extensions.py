"""Shared Flask extensions — initialized once, imported everywhere."""

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager

db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()

# Redirect unauthenticated users to the login page
login_manager.login_view = 'auth.login'
login_manager.login_message_category = 'info'
