import os
from dotenv import load_dotenv

load_dotenv()
basedir = os.path.abspath(os.path.dirname(__file__))
project_root = os.path.abspath(os.path.join(basedir, '..', '..'))

class Config:
    """Base configuration."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-fallback-key')
    
    # Handle relative paths for SQLite
    _raw_db_url = os.environ.get('DATABASE_URL')
    if _raw_db_url and _raw_db_url.startswith('sqlite:///') and not _raw_db_url.startswith('sqlite:////') and ':' not in _raw_db_url[10:]:
        # Resolve relative path against project root
        _path = _raw_db_url.replace('sqlite:///', '')
        _absolute_path = os.path.abspath(os.path.join(project_root, _path))
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{_absolute_path}"
    else:
        # Default Fallback: ../Storage/database/PodLearn.db
        SQLALCHEMY_DATABASE_URI = _raw_db_url or \
            f"sqlite:///{os.path.abspath(os.path.join(project_root, '../Storage/database/PodLearn.db'))}"
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Storage Settings
    STORAGE_TYPE = os.environ.get('STORAGE_TYPE', 'local') # 'local' or 's3'
    
    # Media Path (for local storage)
    _raw_media_path = os.environ.get('MEDIA_PATH', '../Storage/uploads/PodLearnMedia')
    if _raw_media_path and not os.path.isabs(_raw_media_path) and ':' not in _raw_media_path:
        # Resolve against project root
        MEDIA_FOLDER = os.path.abspath(os.path.join(project_root, _raw_media_path))
    else:
        MEDIA_FOLDER = _raw_media_path

    S3_BUCKET = os.environ.get('S3_BUCKET', 'auraflow-storage')
    S3_REGION = os.environ.get('S3_REGION', 'us-east-1')
    S3_ACCESS_KEY = os.environ.get('S3_ACCESS_KEY', None)
    S3_SECRET_KEY = os.environ.get('S3_SECRET_KEY', None)

    # Ecosystem SSO Settings
    CENTRAL_AUTH_SERVER_ADDRESS = os.environ.get('CENTRAL_AUTH_SERVER_ADDRESS', 'http://localhost:5000')
    CENTRAL_AUTH_CLIENT_ID = os.environ.get('CENTRAL_AUTH_CLIENT_ID', 'podlearn-v1')
    CENTRAL_AUTH_CLIENT_SECRET = os.environ.get('CENTRAL_AUTH_CLIENT_SECRET')

    # Celery settings — Support automatic fallback to SQLite if Redis is missing
    CELERY = {
        "broker_url": os.environ.get("CELERY_BROKER_URL", "sqla+sqlite:///" + os.path.join(project_root, "../Storage/database/PodLearn_celery_broker.db")),
        "result_backend": os.environ.get("CELERY_RESULT_BACKEND", "db+sqlite:///" + os.path.join(project_root, "../Storage/database/PodLearn_celery_results.db")),
        "task_default_queue": "podlearn_tasks",
        "broker_connection_retry_on_startup": True
    }

class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
}
