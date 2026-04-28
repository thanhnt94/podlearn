from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from ..models import Sentence, SentenceSet
from ..services.srs_service import calculate_next_review
from app.extensions import db

bp = Blueprint('study_api', __name__)

@bp.route('/sets/<int:set_id>/review', methods=['GET'])
@login_required
def get_review_queue(set_id):
    """Gets sentences due for review in a specific set."""
    sentences = Sentence.query.filter_by(
        set_id=set_id,
        user_id=current_user.id
    ).all()
    
    return jsonify({
        "sentences": [{
            "id": s.id,
            "original_text": s.original_text,
            "translated_text": s.translated_text,
            "audio_url": s.audio_url,
            "mastery_level": s.mastery_level
        } for s in sentences]
    })

@bp.route('/sentences/<int:sentence_id>/review', methods=['POST'])
@login_required
def submit_review(sentence_id):
    """Updates the SRS metadata for a sentence after a review."""
    sentence = Sentence.query.filter_by(
        id=sentence_id,
        user_id=current_user.id
    ).first_or_404()
    
    data = request.json
    quality = data.get('quality', 3)
    
    srs_result = calculate_next_review(
        sentence.mastery_level or 0,
        sentence.interval_days or 0,
        sentence.ease_factor or 2.5,
        quality
    )
    
    sentence.mastery_level = srs_result['mastery_level']
    sentence.interval_days = srs_result['interval_days']
    sentence.ease_factor = srs_result['ease_factor']
    sentence.next_review_at = srs_result['next_review_at']
    
    db.session.commit()
    
    from app.modules.engagement.services.streak_service import update_streak
    update_streak(current_user.id)
    
    return jsonify({
        "status": "success",
        "next_review_at": sentence.next_review_at.isoformat(),
        "new_level": sentence.mastery_level
    })
