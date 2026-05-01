from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, current_user
from datetime import datetime, timezone, timedelta
from app.core.extensions import db
from app.modules.study.models import Lesson
from app.modules.study.signals import study_time_tracked
from app.modules.engagement import interface as engagement_interface

tracking_bp = Blueprint('tracking', __name__,
                        template_folder='../templates',
                        static_folder='../static')

@tracking_bp.route('/ping', methods=['POST'])
@jwt_required()
def ping():
    data = request.get_json() or {}
    listening_seconds = int(data.get('listening_seconds', 0))
    shadowing_count = int(data.get('shadowing_count', 0))
    shadowing_seconds = int(data.get('shadowing_seconds', 0))
    lesson_id = data.get('lesson_id')

    if listening_seconds > 0:
        # Membership lockout check for Free users
        if lesson_id and current_user.role == 'free':
            lesson = Lesson.query.get(lesson_id)
            if lesson and (lesson.time_spent or 0) >= 600:
                return jsonify({
                    'success': False, 
                    'error': 'Video locked', 
                    'is_locked': True,
                    'message': 'Giới hạn học tập cho tài khoản Miễn phí đã hết.'
                }), 403

        # Emit Signal for Engagement to record ActivityLog and update streak
        study_time_tracked.send('tracking', 
            user_id=current_user.id, 
            lesson_id=lesson_id, 
            seconds_added=listening_seconds,
            activity_type='LISTEN_PODCAST'
        )
        
        # Update local lesson progress
        if lesson_id:
            lesson = Lesson.query.get(lesson_id)
            if lesson and lesson.user_id == current_user.id:
                lesson.time_spent = (lesson.time_spent or 0) + listening_seconds

    if shadowing_count > 0:
        # Emit Signal for Shadowing
        study_time_tracked.send('tracking', 
            user_id=current_user.id, 
            lesson_id=lesson_id, 
            seconds_added=shadowing_seconds,
            activity_type='SHADOWING_PRACTICE',
            metric_value=shadowing_count
        )

    db.session.commit()
    
    return jsonify({
        'success': True,
        'current_streak': current_user.current_streak,
        'total_listening_seconds': current_user.total_listening_seconds,
        'total_shadowing_count': current_user.total_shadowing_count
    })

@tracking_bp.route('/stats/daily', methods=['GET'])
@jwt_required()
def daily_stats():
    # Use Engagement Interface for stats
    daily_data = engagement_interface.get_daily_stats_dto(current_user.id, days=7)
    return jsonify(daily_data)

@tracking_bp.route('/stats/summary', methods=['GET'])
@jwt_required()
def stats_summary():
    # Use Engagement Interface for summary
    summary = engagement_interface.get_stats_summary_dto(current_user.id)
    
    daily_data = summary['daily_data']
    hourly_distribution = summary['hourly_distribution']
    total_shadowing_duration = summary['total_shadowing_duration_seconds']

    daily_array = [{'date': k, 'listening_minutes': round(v['listening_minutes'], 1), 'shadowing_count': v['shadowing_count']} for k, v in daily_data.items()]
    
    return jsonify({
        'total_listening_time': current_user.total_listening_seconds or 0,
        'total_shadowing_count': current_user.total_shadowing_count or 0,
        'total_exp': current_user.total_exp or 0,
        'current_streak': current_user.current_streak or 0,
        'daily_data': daily_array,
        'hourly_distribution': [{'hour': k, 'minutes': round(v, 1)} for k, v in hourly_distribution.items()],
        'activity_mix': {
            'listening_minutes': round((current_user.total_listening_seconds or 0) / 60.0, 1),
            'shadowing_minutes': round(total_shadowing_duration / 60.0, 1)
        }
    })
