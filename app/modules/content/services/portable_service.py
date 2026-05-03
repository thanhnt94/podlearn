import json
import logging
from datetime import datetime, timezone
from app.core.extensions import db
from app.modules.content.models import Video, SubtitleTrack
from app.modules.study.models import Lesson, VideoDictionary, VideoGlossary

logger = logging.getLogger(__name__)

def export_lesson_package(lesson_id: int):
    """
    Export all data related to a lesson (Video, Subtitles, Glossaries) into a single JSON object.
    """
    lesson = db.session.get(Lesson, lesson_id)
    if not lesson:
        return None

    video = lesson.video
    
    # 1. Video Metadata
    data = {
        "version": "1.0",
        "export_date": datetime.now(timezone.utc).isoformat(),
        "video": {
            "youtube_id": video.youtube_id,
            "title": video.title,
            "thumbnail_url": video.thumbnail_url,
            "duration_seconds": video.duration_seconds,
            "channel_title": video.channel_title,
            "channel_id": video.channel_id,
            "description": video.description,
            "language_code": video.language_code
        },
        "subtitles": [],
        "dictionaries": []
    }

    # 2. All Subtitle Tracks for this video
    tracks = SubtitleTrack.query.filter_by(video_id=video.id).all()
    for t in tracks:
        data["subtitles"].append({
            "language_code": t.language_code,
            "name": t.name,
            "is_auto_generated": t.is_auto_generated,
            "is_original": t.is_original,
            "content_json": t.content_json
        })

    # 3. All Dictionaries and Glossary Items for this lesson
    dicts = VideoDictionary.query.filter_by(lesson_id=lesson.id).all()
    for d in dicts:
        d_data = {
            "name": d.name,
            "language_code": d.language_code,
            "target_language_code": d.target_language_code,
            "items": []
        }
        for item in d.glossary_items:
            d_data["items"].append({
                "front": item.front,
                "back": item.back,
                "reading": item.reading,
                "source": item.source,
                "extra_data": item.extra_data
            })
        data["dictionaries"].append(d_data)

    return data

def import_lesson_package(user_id: int, package_data: dict):
    """
    Import a lesson package, creating Video, Subtitles, and Glossaries without calling YouTube.
    """
    try:
        v_data = package_data.get("video")
        if not v_data:
            return {"error": "InvalidPackage", "message": "Missing video metadata"}

        youtube_id = v_data["youtube_id"]
        
        # 1. Create or Update Video
        video = Video.query.filter_by(youtube_id=youtube_id).first()
        if not video:
            video = Video(
                youtube_id=youtube_id,
                title=v_data["title"],
                thumbnail_url=v_data["thumbnail_url"],
                duration_seconds=v_data["duration_seconds"],
                channel_title=v_data["channel_title"],
                channel_id=v_data["channel_id"],
                description=v_data["description"],
                language_code=v_data.get("language_code", "ja"),
                status='completed',
                visibility='private',
                owner_id=user_id
            )
            db.session.add(video)
            db.session.flush()
        
        # 2. Create Lesson for user
        lesson = Lesson.query.filter_by(user_id=user_id, video_id=video.id).first()
        if not lesson:
            lesson = Lesson(
                user_id=user_id,
                video_id=video.id,
                original_lang_code=video.language_code,
                target_lang_code='vi'
            )
            db.session.add(lesson)
            db.session.flush()

        # 3. Import Subtitles
        for s_data in package_data.get("subtitles", []):
            # Check if this track already exists for this video
            existing_track = SubtitleTrack.query.filter_by(
                video_id=video.id,
                language_code=s_data["language_code"],
                name=s_data["name"]
            ).first()
            
            if not existing_track:
                track = SubtitleTrack(
                    video_id=video.id,
                    language_code=s_data["language_code"],
                    name=s_data["name"],
                    is_auto_generated=s_data.get("is_auto_generated", False),
                    is_original=s_data.get("is_original", False),
                    content_json=s_data["content_json"],
                    uploader_id=user_id
                )
                db.session.add(track)

        # 4. Import Dictionaries
        for d_data in package_data.get("dictionaries", []):
            # Create the dictionary container
            v_dict = VideoDictionary.query.filter_by(
                lesson_id=lesson.id,
                name=d_data["name"]
            ).first()
            
            if not v_dict:
                v_dict = VideoDictionary(
                    lesson_id=lesson.id,
                    name=d_data["name"],
                    language_code=d_data.get("language_code", "ja"),
                    target_language_code=d_data.get("target_language_code", "vi")
                )
                db.session.add(v_dict)
                db.session.flush()
            
            # Import items
            for item_data in d_data.get("items", []):
                existing_item = VideoGlossary.query.filter_by(
                    dictionary_id=v_dict.id,
                    front=item_data["front"]
                ).first()
                
                if not existing_item:
                    item = VideoGlossary(
                        video_id=video.id,
                        lesson_id=lesson.id,
                        dictionary_id=v_dict.id,
                        front=item_data["front"],
                        back=item_data["back"],
                        reading=item_data.get("reading"),
                        source=item_data.get("source", "manual"),
                        extra_data=item_data.get("extra_data"),
                        language_code=v_dict.language_code,
                        target_language_code=v_dict.target_language_code
                    )
                    db.session.add(item)

        db.session.commit()
        return {"success": True, "lesson_id": lesson.id, "video_id": video.id}

    except Exception as e:
        db.session.rollback()
        logger.exception(f"Failed to import lesson package: {e}")
        return {"error": "ImportFailed", "message": str(e)}
