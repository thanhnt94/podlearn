from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class AdminStats(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    users_count: int
    videos_count: int
    lessons_count: int
    subtitles_count: int

class UserAdminInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    role: str
    is_admin: bool
    created_at: Optional[datetime] = None
    central_auth_id: Optional[str] = None

class UserCreateAdmin(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    password: str
    role: Optional[str] = 'free'

class UserUpdateAdmin(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None

class AppSettingsResponse(BaseModel):
    GEMINI_API_KEY: str
    GEMINI_MODEL: str
    AUTH_PROVIDER: str
    CENTRAL_AUTH_SERVER_ADDRESS: str
    CENTRAL_AUTH_CLIENT_ID: str
    CENTRAL_AUTH_CLIENT_SECRET: str
    YOUTUBE_PROXY_URL: str
    TASK_RUNNER: str

class GeminiSettingsUpdate(BaseModel):
    api_key: Optional[str] = None
    model: Optional[str] = None

class AuthSettingsUpdate(BaseModel):
    base_url: str
    client_id: str
    client_secret: str

class ProxySettingsUpdate(BaseModel):
    proxy_url: str

class VideoAdminInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    visibility: str
    available_languages: List[str] = []
    created_at: Optional[datetime] = None
    owner_id: Optional[int] = None

class TaskRunnerToggle(BaseModel):
    runner: str # 'celery' or 'background'
