from app import create_app

# Initialize the Flask application
flask_app = create_app()

# Extract the celery instance that was attached during create_app()
celery_app = flask_app.extensions.get("celery")

# This file is now the official entry point for the Celery worker
if __name__ == '__main__':
    # Use worker_main to start the worker programmatically
    # This is the compatible way for Celery 5.x+
    celery_app.worker_main(['worker', '--loglevel=info', '--pool=solo'])
