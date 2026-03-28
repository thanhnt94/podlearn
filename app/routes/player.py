"""Player routes — lesson player page."""

from flask import Blueprint, render_template, abort
from flask_login import login_required, current_user
from datetime import datetime, timezone

from ..extensions import db
from ..models.lesson import Lesson

player_bp = Blueprint('player', __name__)


@player_bp.route('/lesson/<int:lesson_id>')
@login_required
def view(lesson_id):
    lesson = Lesson.query.filter_by(
        id=lesson_id,
        user_id=current_user.id
    ).first_or_404()

    # Update last opened
    lesson.last_opened_at = datetime.now(timezone.utc)
    db.session.commit()

    return render_template('player.html', lesson=lesson)
