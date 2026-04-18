from datetime import datetime, timedelta, timezone

def calculate_next_review(current_level, current_interval, current_ease, quality):
    """
    Implements a simplified SM-2 (SuperMemo-2) algorithm.
    quality: 0-5 (0 = forgot, 5 = perfect recall)
    """
    if quality < 3:
        # User forgot or struggled heavily - reset interval but keep mastery progress
        new_interval = 1
        new_level = max(0, current_level - 1)
        # Dip the ease factor if they struggled
        new_ease = max(1.3, current_ease - 0.2)
    else:
        # Success
        new_level = current_level + 1
        
        if current_interval == 0:
            new_interval = 1
        elif current_interval == 1:
            new_interval = 6
        else:
            new_interval = round(current_interval * current_ease)
            
        # Update ease factor
        new_ease = current_ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        new_ease = max(1.3, new_ease)

    next_review_at = datetime.now(timezone.utc) + timedelta(days=new_interval)
    
    return {
        'mastery_level': new_level,
        'interval_days': new_interval,
        'ease_factor': round(new_ease, 2),
        'next_review_at': next_review_at
    }
