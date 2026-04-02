"""Import all models so Alembic can detect them."""

from .user import User          # noqa: F401
from .video import Video        # noqa: F401
from .subtitle import SubtitleTrack  # noqa: F401
from .lesson import Lesson      # noqa: F401
from .note import Note          # noqa: F401
from .shadowing import ShadowingHistory # noqa: F401
from .setting import AppSetting   # noqa: F401
from .sentence import Sentence, SentenceSet    # noqa: F401
