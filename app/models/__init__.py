"""Import all models so Alembic can detect them."""

from .user import User          # noqa: F401
from .video import Video        # noqa: F401
from .subtitle import SubtitleTrack  # noqa: F401
from .lesson import Lesson      # noqa: F401
from .note import Note          # noqa: F401
from .shadowing import ShadowingHistory # noqa: F401
from .setting import AppSetting   # noqa: F401
from .sentence import Sentence, SentenceSet    # noqa: F401
from .share import ShareRequest # noqa: F401
from .comment import Comment         # noqa: F401
from .activity_log import ActivityLog # noqa: F401
from .ai_insight import AIInsightTrack, AIInsightItem # noqa: F401
from .glossary import VideoGlossary, VocabEditHistory # noqa: F401
from .grammar import Grammar # noqa: F401
from .sentence_token import SentenceToken # noqa: F401
from .vocabulary import Vocabulary # noqa: F401 
from .playlist import Playlist # noqa: F401
from .badge import Badge, UserBadge # noqa: F401
from .notification import Notification # noqa: F401
