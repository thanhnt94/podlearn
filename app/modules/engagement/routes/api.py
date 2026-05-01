from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, current_user
from app.modules.engagement.services import streak_service
from ..exceptions import EngagementError

engagement_api = Blueprint('engagement_api', __name__,
                            template_folder='../templates',
                            static_folder='../static')

@engagement_api.route('/streak/freeze', methods=['POST'])
@jwt_required()
def buy_freeze():
    try:
        result = streak_service.buy_streak_freeze(current_user.id)
        return jsonify(result)
    except EngagementError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": "An unexpected error occurred"}), 500

@engagement_api.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    return jsonify({
        "current_streak": current_user.current_streak,
        "longest_streak": current_user.longest_streak,
        "total_exp": current_user.total_exp,
        "current_level": current_user.current_level
    })

