from app import create_app

# Initialize the Flask application
flask_app = create_app()

# Extract the celery instance that was attached during create_app()
celery_app = flask_app.extensions.get("celery")

# This file is now the official entry point for the Celery worker
if __name__ == '__main__':
    # Optional: if you run this file directly with python, it starts a local worker
    import sys
    from celery.bin import worker
    
    application = celery_app
    w = worker.worker(app=application)
    options = {
        'loglevel': 'info',
        'traceback': True,
    }
    w.run(**options)
