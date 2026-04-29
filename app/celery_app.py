from celery import Celery, Task

def celery_init_app(app):
    class FlaskTask(Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery_app = Celery(
        app.name, 
        task_cls=FlaskTask,
        include=[
            'app.modules.study.tasks',
            'app.modules.content.tasks'
        ]
    )
    celery_app.config_from_object(app.config["CELERY"])
    
    # Ensure tasks go to the specific queue used in systemd
    celery_app.conf.task_default_queue = 'podlearn_tasks'
    
    print(f"[CELERY_INIT] Broker: {celery_app.conf.broker_url}", flush=True)
    print(f"[CELERY_INIT] Default Queue: {celery_app.conf.task_default_queue}", flush=True)
    celery_app.set_default()

    # Celery Beat settings for scheduled tasks
    from celery.schedules import crontab
    celery_app.conf.beat_schedule = {
        'run-ai-insights-every-hour': {
            'task': 'app.modules.study.tasks.batch_generate_ai_insights',
            'schedule': crontab(minute=0, hour='*/1'), # Every 1 hour
        },
    }

    app.extensions["celery"] = celery_app
    return celery_app

