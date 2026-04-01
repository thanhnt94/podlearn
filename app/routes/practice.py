from flask import Blueprint, render_template, abort
from flask_login import login_required, current_user
import json

from ..models.sentence import Sentence

practice_bp = Blueprint('practice', __name__)

@practice_bp.route('/sentence/<int:sentence_id>')
@login_required
def sentence_practice(sentence_id):
    """Detailed practice page for a specific sentence pattern."""
    sentence = Sentence.query.filter_by(
        id=sentence_id,
        user_id=current_user.id
    ).first_or_404()

    # Parse detailed_analysis
    analysis = sentence.detailed_analysis
    if isinstance(analysis, str):
        try:
            analysis = json.loads(analysis)
        except json.JSONDecodeError:
            analysis = {}

    return render_template('practice_sentence.html', 
                           sentence=sentence, 
                           analysis=analysis)
