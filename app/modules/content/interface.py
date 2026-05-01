from app.modules.content.models import Video, SubtitleTrack, Playlist
from typing import List, Dict, Any, Optional

def get_video_dto(video_id: int) -> Optional[Dict[str, Any]]:
    video = Video.query.get(video_id)
    if not video:
        return None
    
    return {
        "id": video.id,
        "title": video.title,
        "channel_title": video.channel_title,
        "thumbnail_url": video.thumbnail_url,
        "duration_seconds": video.duration_seconds or 1,
        "owner_name": video.owner.username if video.owner else "System",
        "owner_id": video.owner_id,
        "visibility": video.visibility,
        "youtube_id": video.youtube_id
    }

def get_video_by_youtube_id_dto(youtube_id: str, owner_id: int) -> Optional[Dict[str, Any]]:
    video = Video.query.filter_by(youtube_id=youtube_id, owner_id=owner_id).first()
    if not video:
        return None
    return get_video_dto(video.id)

def create_private_video(youtube_id: str, owner_id: int) -> Dict[str, Any]:
    from app.core.extensions import db
    video = Video(
        youtube_id=youtube_id,
        title="Processing...",
        status='pending',
        owner_id=owner_id,
        visibility='private'
    )
    db.session.add(video)
    db.session.commit()
    return get_video_dto(video.id)

def get_public_videos_dto(limit: int = 24) -> List[Dict[str, Any]]:
    videos = Video.query.filter_by(visibility='public').limit(limit).all()
    return [get_video_dto(v.id) for v in videos]

def get_playlist_dto(playlist_id: int) -> Optional[Dict[str, Any]]:
    playlist = Playlist.query.get(playlist_id)
    if not playlist:
        return None
    
    return {
        "id": playlist.id,
        "name": playlist.name,
        "description": playlist.description,
        "owner_id": playlist.owner_id,
        "video_count": len(playlist.videos),
        "created_at": playlist.created_at.isoformat()
    }

def get_user_playlists_dto(user_id: int) -> List[Dict[str, Any]]:
    playlists = Playlist.query.filter_by(owner_id=user_id).order_by(Playlist.created_at.desc()).all()
    return [get_playlist_dto(p.id) for p in playlists]

def get_playlist_details_dto(playlist_id: int) -> Optional[Dict[str, Any]]:
    playlist = Playlist.query.get(playlist_id)
    if not playlist:
        return None
    
    return {
        "id": playlist.id,
        "name": playlist.name,
        "description": playlist.description,
        "videos": [get_video_dto(v.id) for v in playlist.videos]
    }

def create_playlist_dto(name: str, description: Optional[str], owner_id: int) -> Dict[str, Any]:
    from app.core.extensions import db
    playlist = Playlist(name=name, description=description, owner_id=owner_id)
    db.session.add(playlist)
    db.session.commit()
    return get_playlist_dto(playlist.id)

def delete_playlist(playlist_id: int, owner_id: int) -> bool:
    from app.core.extensions import db
    playlist = Playlist.query.filter_by(id=playlist_id, owner_id=owner_id).first()
    if not playlist:
        return False
    db.session.delete(playlist)
    db.session.commit()
    return True

def add_video_to_playlist(playlist_id: int, video_id: int, owner_id: int) -> bool:
    from app.core.extensions import db
    playlist = Playlist.query.filter_by(id=playlist_id, owner_id=owner_id).first()
    video = Video.query.get(video_id)
    if not playlist or not video:
        return False
    if video not in playlist.videos:
        playlist.videos.append(video)
        db.session.commit()
    return True

def remove_video_from_playlist(playlist_id: int, video_id: int, owner_id: int) -> bool:
    from app.core.extensions import db
    playlist = Playlist.query.filter_by(id=playlist_id, owner_id=owner_id).first()
    video = Video.query.get(video_id)
    if not playlist or not video:
        return False
    if video in playlist.videos:
        playlist.videos.remove(video)
        db.session.commit()
    return True
