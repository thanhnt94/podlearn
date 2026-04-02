from flask import Blueprint, render_template, abort
from flask_login import login_required, current_user
import json

from ..models.sentence import Sentence

practice_bp = Blueprint('practice', __name__)

@practice_bp.route('/sentence/<int:sentence_id>')
@login_required
def sentence_practice(sentence_id):
    """Detailed practice page for a specific sentence pattern with navigation."""
    sentence = Sentence.query.filter_by(
        id=sentence_id,
        user_id=current_user.id
    ).first_or_404()

    # Get set context for navigation and sidebar
    set_sentences = (
        Sentence.query
        .filter_by(set_id=sentence.set_id, user_id=current_user.id)
        .order_by(Sentence.created_at.asc())
        .all()
    )
    
    # Calculate neighbors
    sentence_ids = [s.id for s in set_sentences]
    try:
        current_idx = sentence_ids.index(sentence_id)
        prev_id = sentence_ids[current_idx - 1] if current_idx > 0 else None
        next_id = sentence_ids[current_idx + 1] if current_idx < len(sentence_ids) - 1 else None
    except ValueError:
        prev_id = next_id = None

    # Parse detailed_analysis
    analysis = sentence.detailed_analysis
    if isinstance(analysis, str):
        try:
            analysis = json.loads(analysis)
        except json.JSONDecodeError:
            analysis = {}

    return render_template('practice_sentence.html', 
                           sentence=sentence, 
                           analysis=analysis,
                           set_sentences=set_sentences,
                           prev_id=prev_id,
                           next_id=next_id)
