from celery import Celery
from .config import settings

def create_celery_app():
    celery_app = Celery(
        "podlearn",
        include=[
            'app.modules.study.tasks',
            'app.modules.content.tasks'
        ]
    )
    celery_app.conf.update(settings.CELERY_CONFIG)
    
    # Celery Beat settings for scheduled tasks
    from celery.schedules import crontab
    celery_app.conf.beat_schedule = {
        'run-ai-insights-every-hour': {
            'task': 'app.modules.study.tasks.batch_generate_ai_insights',
            'schedule': crontab(minute=0, hour='*/1'), # Every 1 hour
        },
    }
    
    return celery_app

celery_app = create_celery_app()

def celery_init_app(app=None):
    """Legacy helper for backward compatibility during transition."""
    return celery_app

