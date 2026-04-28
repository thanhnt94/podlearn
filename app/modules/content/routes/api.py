from flask import Blueprint

bp = Blueprint('content_api', __name__)

# Placeholder for future content-related API endpoints
@bp.route('/health', methods=['GET'])
def health():
    return {"status": "ok", "module": "content"}
