from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from datetime import datetime, timezone, timedelta
from ..extensions import db
from sqlalchemy import func
from app.modules.engagement.models import ActivityLog
from app.modules.study.models import Lesson

tracking_bp = Blueprint('tracking', __name__)

@tracking_bp.route('/ping', methods=['POST'])
@login_required
def ping():
    data = request.get_json() or {}
    listening_seconds = int(data.get('listening_seconds', 0))
    shadowing_count = int(data.get('shadowing_count', 0))
    shadowing_seconds = int(data.get('shadowing_seconds', 0))
    lesson_id = data.get('lesson_id')

    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)

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

        log = ActivityLog(
            user_id=current_user.id,
            activity_type='LISTEN_PODCAST',
            duration_seconds=listening_seconds
        )
        db.session.add(log)
        current_user.total_listening_seconds = (current_user.total_listening_seconds or 0) + listening_seconds
        
        # Update lesson-specific total
        if lesson_id:
            lesson = Lesson.query.get(lesson_id)
            if lesson and lesson.user_id == current_user.id:
                lesson.time_spent = (lesson.time_spent or 0) + listening_seconds

    if shadowing_count > 0:
        log = ActivityLog(
            user_id=current_user.id,
            activity_type='SHADOWING_PRACTICE',
            duration_seconds=shadowing_seconds,
            metric_value=shadowing_count
        )
        db.session.add(log)
        current_user.total_shadowing_count = (current_user.total_shadowing_count or 0) + shadowing_count

    # Streak logic if they haven't locked in streak for today
    if current_user.last_study_date != today:
        today_start = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
        
        # Calculate total exact duration they have accumulated today (excluding current transaction lines)
        total_duration_query = db.session.query(func.sum(ActivityLog.duration_seconds)).filter(
            ActivityLog.user_id == current_user.id,
            ActivityLog.created_at >= today_start
        ).scalar() or 0
        
        this_tx_sum = listening_seconds + shadowing_seconds
        
        if total_duration_query + this_tx_sum >= 300: # 5 minutes minimum threshold for streak
            if current_user.last_study_date == yesterday:
                current_user.current_streak = (current_user.current_streak or 0) + 1
            else:
                current_user.current_streak = 1 # Broken streak reset
                
            if current_user.current_streak > (current_user.longest_streak or 0):
                current_user.longest_streak = current_user.current_streak
            
            # Lock it in
            current_user.last_study_date = today

    db.session.commit()
    return jsonify({
        'success': True,
        'current_streak': current_user.current_streak,
        'total_listening_seconds': current_user.total_listening_seconds,
        'total_shadowing_count': current_user.total_shadowing_count
    })

@tracking_bp.route('/stats/daily', methods=['GET'])
@login_required
def daily_stats():
    # Last 7 days stats
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=6)
    
    logs = ActivityLog.query.filter(
        ActivityLog.user_id == current_user.id,
        ActivityLog.created_at >= start_date
    ).all()
    
    daily_data = {}
    for i in range(7):
        d = (start_date + timedelta(days=i)).date().isoformat()
        daily_data[d] = {'listening_seconds': 0, 'shadowing_count': 0}
        
    for log in logs:
        d = log.created_at.date().isoformat()
        if d in daily_data:
            if log.activity_type == 'LISTEN_PODCAST':
                daily_data[d]['listening_seconds'] += (log.duration_seconds or 0)
            elif log.activity_type == 'SHADOWING_PRACTICE':
                daily_data[d]['shadowing_count'] += (log.metric_value or 0)
    
@tracking_bp.route('/stats/summary', methods=['GET'])
@login_required
def stats_summary():
    end_date = datetime.now(timezone.utc)
    start_date_90 = end_date - timedelta(days=90)
    
    logs = ActivityLog.query.filter(
        ActivityLog.user_id == current_user.id,
        ActivityLog.created_at >= start_date_90
    ).all()
    
    daily_data = {}
    for i in range(91):
        d = (start_date_90 + timedelta(days=i)).date().isoformat()
        daily_data[d] = {'listening_minutes': 0, 'shadowing_count': 0}
        
    hourly_distribution = {str(i): 0 for i in range(24)}
    
    for log in logs:
        d = log.created_at.date().isoformat()
        if d in daily_data:
            if log.activity_type == 'LISTEN_PODCAST':
                daily_data[d]['listening_minutes'] += (log.duration_seconds or 0) / 60.0
            elif log.activity_type == 'SHADOWING_PRACTICE':
                daily_data[d]['shadowing_count'] += (log.metric_value or 0)
        
        # Hourly based on local time (Server time approximation)
        h = str(log.created_at.hour)
        if log.activity_type == 'LISTEN_PODCAST':
            hourly_distribution[h] += (log.duration_seconds or 0) / 60.0
            
    # Calculate all-time shadowing duration for activity mix
    total_shadowing_duration = db.session.query(func.sum(ActivityLog.duration_seconds)).filter(
        ActivityLog.user_id == current_user.id,
        ActivityLog.activity_type == 'SHADOWING_PRACTICE'
    ).scalar() or 0

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
