"""Shared Flask extensions — initialized once, imported everywhere."""

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager

from celery import Celery, Task

from flask_wtf.csrf import CSRFProtect

db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()
csrf = CSRFProtect()


# Redirect unauthenticated users to the login page
login_manager.login_view = 'auth.login'
login_manager.login_message_category = 'info'


def celery_init_app(app) -> Celery:
    class FlaskTask(Task):
        def __call__(self, *args: object, **kwargs: object) -> object:
            with app.app_context():
                return self.run(*args, **kwargs)

    celery_app = Celery(app.name, task_cls=FlaskTask)
    celery_app.config_from_object(app.config, namespace='CELERY')
    celery_app.set_default()
    app.extensions["celery"] = celery_app
    return celery_app
