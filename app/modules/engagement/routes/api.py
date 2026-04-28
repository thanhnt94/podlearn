from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from ..services import streak_service
from ..exceptions import EngagementError

bp = Blueprint('engagement_api', __name__)

@bp.route('/streak/freeze', methods=['POST'])
@login_required
def buy_freeze():
    try:
        result = streak_service.buy_streak_freeze(current_user.id)
        return jsonify(result)
    except EngagementError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": "An unexpected error occurred"}), 500

@bp.route('/stats', methods=['GET'])
@login_required
def get_stats():
    return jsonify({
        "current_streak": current_user.current_streak,
        "longest_streak": current_user.longest_streak,
        "total_exp": current_user.total_exp,
        "current_level": current_user.current_level
    })
