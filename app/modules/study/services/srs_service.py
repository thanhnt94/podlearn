from datetime import datetime, timedelta, timezone
import json
from app.core.extensions import db, redis_client
from ..models import Sentence

def calculate_next_review(current_level, current_interval, current_ease, quality):
    """
    Implements a simplified SM-2 (SuperMemo-2) algorithm.
    quality: 0-5 (0 = forgot, 5 = perfect recall)
    """
    if quality < 3:
        new_interval = 1
        new_level = max(0, current_level - 1)
        new_ease = max(1.3, current_ease - 0.2)
    else:
        new_level = current_level + 1
        
        if current_interval == 0:
            new_interval = 1
        elif current_interval == 1:
            new_interval = 6
        else:
            new_interval = round(current_interval * current_ease)
            
        new_ease = current_ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        new_ease = max(1.3, new_ease)

    next_review_at = datetime.now(timezone.utc) + timedelta(days=new_interval)
    
    return {
        'mastery_level': new_level,
        'interval_days': new_interval,
        'ease_factor': round(new_ease, 2),
        'next_review_at': next_review_at
    }

def get_due_sentences(user_id):
    """
    Gets sentences due for review for a specific user, with Redis caching.
    """
    cache_key = f"srs:due_sentences:{user_id}"
    
    if redis_client:
        cached_data = redis_client.get(cache_key)
        if cached_data:
            return json.loads(cached_data)

    now = datetime.now(timezone.utc)
    due_sentences = Sentence.query.filter(
        Sentence.user_id == user_id,
        Sentence.next_review_at <= now
    ).all()
    
    result = [s.id for s in due_sentences]
    
    if redis_client:
        # Cache for 1 hour
        redis_client.setex(cache_key, 3600, json.dumps(result))
        
    return result

def invalidate_due_cache(user_id):
    """
    Invalidates the due sentences cache for a user.
    """
    if redis_client:
        cache_key = f"srs:due_sentences:{user_id}"
        redis_client.delete(cache_key)

