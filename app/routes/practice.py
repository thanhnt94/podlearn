from flask import Blueprint, render_template, abort, redirect, url_for, request
from flask_login import login_required, current_user
import json

from ..models.sentence import Sentence

practice_bp = Blueprint('practice', __name__)

@practice_bp.route('/sentence/<int:sentence_id>', endpoint='sentence_practice_legacy') # Legacy
@practice_bp.route('/practice/<string:mode>/<int:sentence_id>', endpoint='sentence_practice')
@login_required
def sentence_practice(sentence_id, mode=None):
    """Detailed practice page for a specific sentence pattern with navigation."""
    sentence = Sentence.query.filter_by(
        id=sentence_id,
        user_id=current_user.id
    ).first_or_404()

    # Define template mapping based on set type
    template_map = {
        'mastery_grammar': 'practice_grammar.html',
        'mastery_vocab': 'practice_vocab.html',
        'mastery_sentence': 'practice_sentence.html'
    }
    
    # URL Integrity: Redirect to canonical mode-specific URL
    mode_map = {
        'mastery_grammar': 'grammar',
        'mastery_vocab': 'vocab',
        'mastery_sentence': 'sentence'
    }
    
    expected_mode = mode_map.get(sentence.sentence_set.set_type, 'sentence')
    template_name = template_map.get(sentence.sentence_set.set_type, 'practice_sentence.html')
    
    # Check if current path matches expected track mode
    if f'/practice/{expected_mode}/' not in request.path:
        return redirect(url_for('practice.sentence_practice', sentence_id=sentence_id, mode=expected_mode))

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
    analysis = sentence.detailed_analysis or {}
    if isinstance(analysis, str):
        try:
            analysis = json.loads(analysis)
        except json.JSONDecodeError:
            analysis = {}

    return render_template(template_name, 
                           sentence=sentence, 
                           analysis=analysis,
                           set_sentences=set_sentences,
                           prev_id=prev_id,
                           next_id=next_id,
                           mode_map=mode_map)


@practice_bp.route('/mastery/<int:sentence_id>')
@login_required
def mastery_view(sentence_id):
    """Deep analysis view for a specific sentence, showcasing linked grammar and vocab."""
    sentence = Sentence.query.filter_by(
        id=sentence_id,
        user_id=current_user.id
    ).first_or_404()
    
    return render_template('mastery_view.html', sentence=sentence)
