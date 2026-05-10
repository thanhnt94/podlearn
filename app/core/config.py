import os
from typing import Optional, Dict, Any
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    SECRET_KEY: str = Field(default="dev-fallback-key")
    DATABASE_URL: str = Field(default="sqlite:///../Storage/database/PodLearn.db")
    
    # Storage Settings
    STORAGE_TYPE: str = Field(default="local") # 'local' or 's3'
    MEDIA_PATH: str = Field(default="../Storage/uploads/PodLearnMedia")

    S3_BUCKET: str = Field(default="auraflow-storage")
    S3_REGION: str = Field(default="us-east-1")
    S3_ACCESS_KEY: Optional[str] = None
    S3_SECRET_KEY: Optional[str] = None

    # Ecosystem SSO Settings
    CENTRAL_AUTH_SERVER_ADDRESS: str = Field(default="http://localhost:5000")
    CENTRAL_AUTH_CLIENT_ID: str = Field(default="podlearn-v1")
    CENTRAL_AUTH_CLIENT_SECRET: Optional[str] = None
    FRONTEND_URL: Optional[str] = None

    # Task Runner Mode: 'celery' or 'background'
    TASK_RUNNER: str = Field(default="background")

    # Celery settings
    CELERY_BROKER_URL: Optional[str] = None
    CELERY_RESULT_BACKEND: Optional[str] = None

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        # Resolve relative sqlite paths against project root if needed
        # (FastAPI logic can be more direct than Flask's config_by_name)
        if self.DATABASE_URL.startswith("sqlite:///") and not self.DATABASE_URL.startswith("sqlite:////") and ":" not in self.DATABASE_URL[10:]:
             # This is a bit complex to do in a property without context, 
             # but we'll assume the caller handles absolute paths or we provide a helper.
             pass
        return self.DATABASE_URL

    @property
    def CELERY_CONFIG(self) -> Dict[str, Any]:
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
        broker = self.CELERY_BROKER_URL or ("sqla+sqlite:///" + os.path.join(project_root, "../Storage/database/PodLearn_celery_broker.db"))
        backend = self.CELERY_RESULT_BACKEND or ("db+sqlite:///" + os.path.join(project_root, "../Storage/database/PodLearn_celery_results.db"))
        return {
            "broker_url": broker,
            "result_backend": backend,
            "task_default_queue": "podlearn_tasks",
            "broker_connection_retry_on_startup": True
        }

settings = Settings()
