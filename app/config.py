import os

basedir = os.path.abspath(os.path.dirname(__file__))


class Config:
    """Base configuration."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-fallback-key')
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'sqlite:///c:/Code/Ecosystem/Storage/database/AuraFlow.db'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Background Tasks config (if needed)

    # Storage Settings
    STORAGE_TYPE = os.environ.get('STORAGE_TYPE', 'local') # 'local' or 's3'
    S3_BUCKET = os.environ.get('S3_BUCKET', 'auraflow-storage')
    S3_REGION = os.environ.get('S3_REGION', 'us-east-1')
    S3_ACCESS_KEY = os.environ.get('S3_ACCESS_KEY', None)
    S3_SECRET_KEY = os.environ.get('S3_SECRET_KEY', None)

    # Ecosystem SSO Settings
    CENTRAL_AUTH_SERVER_ADDRESS = os.environ.get('CENTRAL_AUTH_SERVER_ADDRESS', 'http://localhost:5000')



class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
}
