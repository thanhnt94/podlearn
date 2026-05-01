from blinker import Namespace

study_signals = Namespace()

# Signal emitted when study time is tracked for a lesson
# Payload: user_id, lesson_id, seconds_added, activity_type (e.g., 'LISTEN_PODCAST', 'SHADOWING_PRACTICE'), metric_value
study_time_tracked = study_signals.signal('study-time-tracked')

# Signal emitted when a lesson is marked completed
# Payload: user_id, lesson_id
lesson_completed = study_signals.signal('lesson-completed')

# Signal emitted when shadowing practice is evaluated
# Payload: user_id, video_id, lesson_id, sentence_id, original_text, spoken_text, accuracy_score, start_time, end_time
shadowing_completed = study_signals.signal('shadowing-completed')
