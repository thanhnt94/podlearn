from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Any
from datetime import datetime

class TrackMetadata(BaseModel):
    id: int
    language_code: str
    is_auto_generated: bool
    name: str
    uploader_name: str
    status: str
    is_original: Optional[bool] = None
    uploader_id: Optional[int] = None
    fetched_at: Optional[datetime] = None
    line_count: Optional[int] = None
    note: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class LessonPlayerInfo(BaseModel):
    id: int
    title: str
    video_id: str
    total_time_spent: int
    settings: dict

class SubtitlesPlayerInfo(BaseModel):
    track_1_id: Optional[int] = None
    track_2_id: Optional[int] = None
    track_3_id: Optional[int] = None
    available_tracks: List[TrackMetadata]
    youtube_original_available: bool = True

class PlayerDataResponse(BaseModel):
    status: str = "success"
    lesson: LessonPlayerInfo
    subtitles: SubtitlesPlayerInfo

class SubtitleUpdateName(BaseModel):
    name: Optional[str] = None
    language_code: Optional[str] = None

class SubtitleTranslateRequest(BaseModel):
    target_lang: str = "vi"
    name: Optional[str] = None

class HandsFreeGenerateRequest(BaseModel):
    video_id: int
    lesson_id: Optional[int] = None
    track_source: str = "original"
    lang: str = "vi"

class SubtitleFullUpdate(BaseModel):
    content: str

class SubtitleLineUpdate(BaseModel):
    text: str

class CuratedSection(BaseModel):
    id: str
    title: str
    content: str

class VideoVisibilityUpdate(BaseModel):
    visibility: Optional[str] = None
    is_public: Optional[bool] = None
