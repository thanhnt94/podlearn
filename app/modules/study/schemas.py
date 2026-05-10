from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, date

class VideoPlayerInfo(BaseModel):
    id: int
    title: str
    channel_title: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration_seconds: int
    owner_name: str
    visibility: str

class LessonDashboardInfo(BaseModel):
    id: int
    time_spent: int
    is_completed: bool
    is_locked: bool
    last_accessed: Optional[datetime] = None
    video: VideoPlayerInfo

class SentenceSetDashboardInfo(BaseModel):
    id: int
    title: str
    set_type: str
    visibility: str
    count: int
    first_sentence_id: Optional[int] = None
    updated_at: Optional[datetime] = None

class DashboardInitResponse(BaseModel):
    lessons: List[LessonDashboardInfo]
    community_videos: List[Any]
    notifications: List[Any]
    sets: List[SentenceSetDashboardInfo]
    stats: Dict[str, Any]

class TrackProgressRequest(BaseModel):
    lesson_id: int
    listening_seconds: int = 0
    shadowing_count: int = 0
    shadowing_seconds: int = 0

class NoteResponse(BaseModel):
    id: int
    timestamp: float
    content: str
    created_at: datetime

class NoteCreate(BaseModel):
    timestamp: float
    content: str

class NoteBatchCreate(BaseModel):
    notes: List[NoteCreate]

class NoteUpdate(BaseModel):
    content: Optional[str] = None
    timestamp: Optional[float] = None

class VocabItem(BaseModel):
    id: Optional[int] = None
    front: str
    back: str
    reading: Optional[str] = None
    source: Optional[str] = None

class VocabListResponse(BaseModel):
    vocab: List[VocabItem]

class VocabAddRequest(BaseModel):
    lesson_id: int
    word: str
    reading: Optional[str] = None
    meaning: str

class VocabUpdateRequest(BaseModel):
    front: Optional[str] = None
    back: Optional[str] = None
    reading: Optional[str] = None
    meaning: Optional[str] = None

class TokenInfo(BaseModel):
    surface: str
    lemma: Optional[str] = None
    pos: Optional[str] = None
    is_skipped: bool = False
    reading: Optional[str] = None
    meaning: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class SaveTokensRequest(BaseModel):
    lesson_id: int
    line_index: int
    tokens: List[TokenInfo]
    sync_global: bool = True

class PropagateVocabRequest(BaseModel):
    lesson_id: int
    lemma: str
    new_lemma: Optional[str] = None
    status: str # 'use' or 'skip'

class ShadowingTrackRequest(BaseModel):
    lesson_id: int
    line_index: int
    audio_blob_id: Optional[str] = None
    score: Optional[float] = None

class LessonSettingsUpdate(BaseModel):
    settings: Dict[str, Any]

class VideoCreateRequest(BaseModel):
    youtube_url: str
    visibility: Optional[str] = 'private'

class BatchAnalyzeRequest(BaseModel):
    lesson_id: int
    texts: List[str]
    is_first_batch: bool = False

class WordMapUpdateStatus(BaseModel):
    lemma: str
    status: str # 'use' or 'skip'
