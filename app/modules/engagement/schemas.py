from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

class UserBasicInfo(BaseModel):
    id: int
    username: str
    avatar_url: Optional[str] = None

class CommentResponse(BaseModel):
    id: int
    content: str
    video_timestamp: Optional[float] = None
    created_at: datetime
    likes: int
    user: UserBasicInfo
    replies_count: int

class CommentCreate(BaseModel):
    content: str
    video_timestamp: Optional[float] = None
    parent_id: Optional[int] = None

class StreakInfo(BaseModel):
    current: int
    longest: int
    last_study_date: Optional[datetime] = None

class ProgressionInfo(BaseModel):
    exp: int
    level: int
    next_level_exp: int

class UserBadgeInfo(BaseModel):
    id: int
    name: str
    description: str
    icon: Optional[str] = None
    is_earned: bool
    requirement_type: str
    threshold: int

class GamificationStatusResponse(BaseModel):
    streak: StreakInfo
    progression: ProgressionInfo
    badges: List[Any] # Depends on engagement_interface return type

class LeaderboardEntry(BaseModel):
    username: str
    exp: int
    streak: int
    avatar: Optional[str] = None
