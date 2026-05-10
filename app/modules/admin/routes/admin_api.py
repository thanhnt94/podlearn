from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import logging
import uuid

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.core.utils.auth_decorators import require_admin
from app.modules.identity.models import User
from app.modules.content.models import Video, SubtitleTrack
from app.modules.study.models import Lesson
from app.modules.engagement.models import AppSetting
from app.modules.admin.schemas import (
    AdminStats, UserAdminInfo, UserCreateAdmin, UserUpdateAdmin,
    AppSettingsResponse, GeminiSettingsUpdate, AuthSettingsUpdate,
    ProxySettingsUpdate, VideoAdminInfo, TaskRunnerToggle
)
from app.core.utils.ecosystem_sso import EcosystemAuth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["Admin"])

@router.get('/stats', response_model=AdminStats)
def get_stats(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Aggregate statistics for the modern dashboard."""
    return AdminStats(
        users_count=db.query(User).count(),
        videos_count=db.query(Video).count(),
        lessons_count=db.query(Lesson).count(),
        subtitles_count=db.query(SubtitleTrack).count()
    )

@router.get('/users', response_model=List[UserAdminInfo])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """List all users with basic info."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return users

@router.post('/users', response_model=Dict[str, Any], status_code=201)
def create_user(data: UserCreateAdmin, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Create a new local user."""
    if db.query(User).filter((User.username == data.username) | (User.email == data.email)).first():
        raise HTTPException(status_code=400, detail="Username or Email already exists")

    user = User(username=data.username, email=data.email, full_name=data.full_name, role=data.role)
    user.set_password(data.password)
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "message": f"User {data.username} created successfully",
        "user": user
    }

@router.put('/users/{user_id}')
@router.patch('/users/{user_id}')
def update_user(user_id: int, data: UserUpdateAdmin, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Full update for a user's profile."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if data.username and data.username != user.username:
        if db.query(User).filter_by(username=data.username).first():
            raise HTTPException(status_code=400, detail="Username already taken")
        user.username = data.username
        
    if data.email and data.email != user.email:
        if db.query(User).filter_by(email=data.email).first():
            raise HTTPException(status_code=400, detail="Email already registered")
        user.email = data.email
        
    if data.full_name is not None:
        user.full_name = data.full_name
        
    if data.role:
        if data.role not in ['free', 'vip', 'admin']:
            raise HTTPException(status_code=400, detail="Invalid role. Use: free, vip, admin")
        user.role = data.role
        
    if data.password:
        user.set_password(data.password)
        
    db.commit()
    return {"success": True, "message": f"User {user.username} updated successfully"}

@router.delete('/users/{user_id}')
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Delete a user."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
        
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"success": True, "message": f"User {user.username} deleted"}

@router.get('/settings', response_model=AppSettingsResponse)
def get_settings(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Fetch AI and Auth settings."""
    return AppSettingsResponse(
        GEMINI_API_KEY=AppSetting.get('GEMINI_API_KEY', ''),
        GEMINI_MODEL=AppSetting.get('GEMINI_MODEL', 'gemini-2.0-flash'),
        AUTH_PROVIDER=AppSetting.get('AUTH_PROVIDER', 'local'),
        CENTRAL_AUTH_SERVER_ADDRESS=AppSetting.get('CENTRAL_AUTH_SERVER_ADDRESS', ''),
        CENTRAL_AUTH_CLIENT_ID=AppSetting.get('CENTRAL_AUTH_CLIENT_ID', ''),
        CENTRAL_AUTH_CLIENT_SECRET=AppSetting.get('CENTRAL_AUTH_CLIENT_SECRET', ''),
        YOUTUBE_PROXY_URL=AppSetting.get('YOUTUBE_PROXY_URL', ''),
        TASK_RUNNER=AppSetting.get('TASK_RUNNER', 'celery')
    )

@router.post('/settings/gemini')
def save_gemini_settings(data: GeminiSettingsUpdate, current_user: User = Depends(require_admin)):
    if data.api_key is not None:
        AppSetting.set('GEMINI_API_KEY', data.api_key, category='ai')
    if data.model:
        AppSetting.set('GEMINI_MODEL', data.model, category='ai')
    return {'success': True, 'message': 'Đã cập nhật cấu hình Gemini.'}

@router.post('/settings/task-runner')
def set_task_runner(data: TaskRunnerToggle, current_user: User = Depends(require_admin)):
    if data.runner not in ['celery', 'background']:
        raise HTTPException(status_code=400, detail="Invalid runner. Use: celery, background")
    AppSetting.set('TASK_RUNNER', data.runner, category='infrastructure')
    return {'success': True, 'message': f'Đã chuyển sang: {data.runner}'}

@router.post('/save-auth-settings')
def save_auth_settings(data: AuthSettingsUpdate, current_user: User = Depends(require_admin)):
    base_url = data.base_url.strip().rstrip('/')
    if base_url and not base_url.startswith(('http://', 'https://')):
        base_url = f"https://{base_url}"
        
    client_id = data.client_id.strip().strip('"').strip("'")
    client_secret = data.client_secret.strip().strip('"').strip("'")

    if not (client_secret.count('.') > 5 or client_secret.count('*') > 5):
        AppSetting.set('CENTRAL_AUTH_CLIENT_SECRET', client_secret, category='auth')

    AppSetting.set('CENTRAL_AUTH_SERVER_ADDRESS', base_url, category='auth')
    AppSetting.set('CENTRAL_AUTH_CLIENT_ID', client_id, category='auth')

    return {'success': True, 'message': 'Đã lưu cấu hình kết nối Ecosystem.'}

@router.post('/settings/proxy')
def save_proxy_settings(data: ProxySettingsUpdate, current_user: User = Depends(require_admin)):
    AppSetting.set('YOUTUBE_PROXY_URL', data.proxy_url.strip(), category='infrastructure')
    return {'success': True, 'message': 'Đã cập nhật proxy cho YouTube.'}

@router.post('/test-auth')
def test_auth_connection(data: AuthSettingsUpdate, current_user: User = Depends(require_admin)):
    import requests
    base_url = data.base_url.strip().rstrip('/')
    if base_url and not base_url.startswith(('http://', 'https://')):
        base_url = f"https://{base_url}"
        
    client_id = data.client_id.strip().strip('"').strip("'")
    client_secret = data.client_secret.strip().strip('"').strip("'")

    current_secret = AppSetting.get('CENTRAL_AUTH_CLIENT_SECRET', '')
    if not client_secret or client_secret.count('.') > 5 or client_secret.count('*') > 5:
        client_secret = current_secret

    AppSetting.set('CENTRAL_AUTH_SERVER_ADDRESS', base_url, category='auth')
    AppSetting.set('CENTRAL_AUTH_CLIENT_ID', client_id, category='auth')
    if client_secret:
        AppSetting.set('CENTRAL_AUTH_CLIENT_SECRET', client_secret, category='auth')

    try:
        discovery_response = requests.get(f"{base_url}/api/auth/discovery", timeout=5)
        if discovery_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Không thể kết nối tới Discovery endpoint")
        
        auth_helper = EcosystemAuth(base_url, client_id, client_secret)
        validation = auth_helper.validate_client()
        
        if not validation.get('success'):
            raise HTTPException(status_code=401, detail=f"Bắt tay thất bại: {validation.get('error')}")
            
        return {
            'success': True, 
            'message': f'Kết nối thành công! Đã xác thực client: {validation.get("client_name")}', 
            'discovery': discovery_response.json()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")

@router.post('/ecosystem-sync')
def ecosystem_sync_webhook(data: Dict[str, Any], db: Session = Depends(get_db)):
    """Incoming sync from CentralAuth Hub."""
    hub_secret = data.get('hub_secret')
    current_secret = AppSetting.get('CENTRAL_AUTH_CLIENT_SECRET', '')
    
    if not hub_secret or (hub_secret != current_secret and hub_secret != settings.SECRET_KEY):
        raise HTTPException(status_code=401, detail="Unauthorized Hub Sync")
        
    if 'server_address' in data:
        AppSetting.set('CENTRAL_AUTH_SERVER_ADDRESS', str(data['server_address']).strip(), category='auth')
    if 'client_id' in data:
        AppSetting.set('CENTRAL_AUTH_CLIENT_ID', str(data['client_id']).strip(), category='auth')
    if 'client_secret' in data:
        AppSetting.set('CENTRAL_AUTH_CLIENT_SECRET', str(data['client_secret']).strip(), category='auth')

    users_data = data.get('users', [])
    if users_data:
        sync_count = 0
        for u_info in users_data:
            user = db.query(User).filter((User.email == u_info['email']) | (User.username == u_info['username'])).first()
            if not user:
                user = User(username=u_info['username'], email=u_info['email'], full_name=u_info.get('full_name', ''), role=u_info.get('role', 'free'))
                user.set_password(str(uuid.uuid4()))
                db.add(user)
                sync_count += 1
            else:
                if user.email == u_info['email']:
                    user.username = u_info['username']
                user.full_name = u_info.get('full_name', user.full_name)
        
        if sync_count > 0:
            db.commit()
            return {"success": True, "message": f"Ecosystem Sync Successful. Provisioned {sync_count} users."}
        
    return {"success": True, "message": "Ecosystem Sync Successful (Settings only)"}

@router.get('/videos', response_model=List[VideoAdminInfo])
def list_videos(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """List videos, including pending approvals."""
    videos = db.query(Video).order_by(Video.created_at.desc()).all()
    return videos

@router.get('/pending-videos', response_model=List[VideoAdminInfo])
def pending_videos(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    videos_list = db.query(Video).filter_by(visibility='pending_public').order_by(Video.created_at.desc()).all()
    return videos_list

@router.post('/video/{video_id}/approve-public')
def approve_public_video(video_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    video = db.get(Video, video_id)
    if not video: raise HTTPException(status_code=404)
    video.visibility = 'public'
    db.commit()
    return {'success': True, 'message': f'Video "{video.title}" is now public!'}

@router.post('/video/{video_id}/reject-public')
def reject_public_video(video_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    video = db.get(Video, video_id)
    if not video: raise HTTPException(status_code=404)
    video.visibility = 'private'
    db.commit()
    return {'success': True, 'message': f'Video "{video.title}" request rejected (set to private).'}

@router.post('/video/{video_id}/visibility')
def set_video_visibility(video_id: int, data: Dict[str, str], db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    visibility = data.get('visibility')
    if visibility not in ['private', 'public', 'pending_public']:
        raise HTTPException(status_code=400, detail="Invalid visibility status")
    video = db.get(Video, video_id)
    if not video: raise HTTPException(status_code=404)
    video.visibility = visibility
    db.commit()
    return {'success': True, 'visibility': video.visibility}
