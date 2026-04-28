from flask import Blueprint, jsonify, request
from ..services import auth_service, user_service
from ..exceptions import IdentityError
from flask_login import login_user, logout_user, login_required, current_user
from ..schemas import UserSchema

bp = Blueprint('identity_api', __name__)
user_schema = UserSchema()

@bp.route('/login', methods=['POST'])
def login():
    data = request.json
    try:
        user = auth_service.authenticate(data.get('username'), data.get('password'))
        login_user(user)
        return jsonify({"message": "Login successful", "user": user_schema.dump(user)})
    except IdentityError as e:
        return jsonify({"error": str(e)}), 401

@bp.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logout successful"})

@bp.route('/me', methods=['GET'])
@login_required
def get_me():
    return jsonify(user_schema.dump(current_user))
