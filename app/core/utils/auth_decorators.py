from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, current_user

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        verify_jwt_in_request()
        if not current_user or not getattr(current_user, 'is_admin', False):
            return jsonify({"status": "error", "message": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated_function

def vip_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        verify_jwt_in_request()
        if not current_user or not getattr(current_user, 'is_at_least_vip', False):
            return jsonify({"status": "error", "message": "VIP access required"}), 403
        return f(*args, **kwargs)
    return decorated_function
