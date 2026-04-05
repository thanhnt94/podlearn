from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user

from ..extensions import db
from ..models.user import User
from ..models.video import Video
from ..models.share import ShareRequest
from ..models.lesson import Lesson

share_bp = Blueprint('share', __name__, url_prefix='/api/share')

@share_bp.route('/search_users', methods=['GET'])
@login_required
def search_users():
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify({'users': []})
    users = User.query.filter(User.username.ilike(f'%{q}%'), User.id != current_user.id).limit(10).all()
    return jsonify({'users': [u.username for u in users]})

@share_bp.route('/request', methods=['POST'])
@login_required
def send_request():
    data = request.get_json() or {}
    video_id = data.get('video_id')
    username = data.get('username')

    if not video_id or not username:
        return jsonify({'error': 'video_id and username required'}), 400

    receiver = User.query.filter_by(username=username).first()
    if not receiver:
        return jsonify({'error': 'User not found'}), 404

    if receiver.id == current_user.id:
        return jsonify({'error': 'Cannot share with yourself'}), 400

    video = Video.query.filter_by(id=video_id, owner_id=current_user.id).first()
    if not video:
        return jsonify({'error': 'Only the owner can share this video'}), 403

    existing = ShareRequest.query.filter_by(
        video_id=video_id, sender_id=current_user.id, receiver_id=receiver.id
    ).first()

    if existing and existing.status in ['pending', 'accepted']:
        return jsonify({'error': f'Already shared or pending with {username}'}), 400

    req = ShareRequest(
        video_id=video_id,
        sender_id=current_user.id,
        receiver_id=receiver.id
    )
    db.session.add(req)
    db.session.commit()

    return jsonify({'success': True, 'message': f'Invitation sent to {username}'})

@share_bp.route('/pending', methods=['GET'])
@login_required
def get_pending():
    reqs = ShareRequest.query.filter_by(receiver_id=current_user.id, status='pending').all()
    out = []
    for r in reqs:
        out.append({
            'share_id': r.id,
            'video_title': r.video.title,
            'sender_name': r.sender.username,
            'created_at': r.created_at.isoformat()
        })
    return jsonify({'pending': out})

@share_bp.route('/<int:share_id>/respond', methods=['POST'])
@login_required
def respond_request(share_id):
    data = request.get_json() or {}
    action = data.get('action') # 'accept' or 'reject'

    req = ShareRequest.query.filter_by(id=share_id, receiver_id=current_user.id).first_or_404()

    if action == 'accept':
        req.status = 'accepted'
        
        # Create a Lesson linking the receiver to the sender's video
        existing_lesson = Lesson.query.filter_by(user_id=current_user.id, video_id=req.video_id).first()
        if not existing_lesson:
            lesson = Lesson(user_id=current_user.id, video_id=req.video_id)
            db.session.add(lesson)
            
        db.session.commit()
        return jsonify({'success': True, 'message': 'Video added to your library!'})
    elif action == 'reject':
        req.status = 'rejected'
        db.session.delete(req) # Delete to keep it clean
        db.session.commit()
        return jsonify({'success': True, 'message': 'Invitation rejected.'})

    return jsonify({'error': 'Invalid action'}), 400
