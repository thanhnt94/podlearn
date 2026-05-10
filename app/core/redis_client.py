import redis
import logging
from .config import settings

logger = logging.getLogger(__name__)

def create_redis_client():
    broker_url = settings.CELERY_BROKER_URL
    if not broker_url or 'redis' not in broker_url:
        return None
        
    try:
        client = redis.from_url(broker_url, decode_responses=True)
        # Test connection
        client.ping()
        return client
    except Exception as e:
        logger.warning(f"Redis client could not connect: {e}")
        return None

redis_client = create_redis_client()
