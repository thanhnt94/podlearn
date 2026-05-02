from flask import Blueprint, request, redirect, current_app, url_for, jsonify, session
import requests
import urllib.parse

class EcosystemAuth:
    """
    Standardized 'Power Pairing' Helper for Mindstack Satellite Apps.
    """
    def __init__(self, server_url, client_id, client_secret):
        self.server_url = server_url.rstrip('/')
        self.client_id = client_id
        self.client_secret = client_secret

    def get_login_url(self, callback_url):
        """Generates the redirect URL to Central Auth."""
        params = urllib.parse.urlencode({
            'client_id': self.client_id,
            'return_to': callback_url
        })
        return f"{self.server_url}/api/auth/login?{params}"

    def handle_callback(self, code, callback_url=None):
        """Exchanges authorization code for tokens and fetches user info."""
        token_url = f"{self.server_url}/api/auth/token"
        payload = {
            "code": code,
            "client_id": self.client_id,
            "client_secret": self.client_secret
        }
        if callback_url:
            payload["redirect_uri"] = callback_url
        
        try:
            r = requests.post(token_url, json=payload, timeout=5)
            r.raise_for_status()
            tokens = r.json()
            
            verify_url = f"{self.server_url}/api/auth/verify-token"
            headers = {"Authorization": f"Bearer {tokens['access_token']}"}
            v = requests.get(verify_url, headers=headers, timeout=5)
            v.raise_for_status()
            
            return {
                "success": True,
                "user": v.json().get('user'),
                "tokens": tokens
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_logout_url(self, return_to=None):
        """Initiates Global Logout."""
        url = f"{self.server_url}/api/auth/logout"
        if return_to:
            params = urllib.parse.urlencode({'return_to': return_to})
            url += f"?{params}"
        return url

def create_sso_blueprint(server_url, client_id, client_secret, on_user_provision, login_success_redirect_fn):
    """
    Factory to create a standardized SSO Blueprint for any satellite app.
    
    Args:
        server_url: URL of CentralAuth
        client_id: App's client ID
        client_secret: App's client secret
        on_user_provision: Callback function(user_data, tokens) -> user_object
        login_success_redirect_fn: Callback function(user_object, tokens) -> redirect_response
    """
    bp = Blueprint('ecosystem_sso', __name__)
    auth = EcosystemAuth(server_url, client_id, client_secret)

    @bp.route('/auth-center/login')
    def login():
        callback_url = url_for('ecosystem_sso.callback', _external=True)
        if 'mindstack.click' in callback_url:
            callback_url = callback_url.replace('http://', 'https://')
        return redirect(auth.get_login_url(callback_url))

    @bp.route('/auth-center/callback')
    def callback():
        code = request.args.get('code')
        if not code:
            return redirect(url_for('ecosystem_sso.login'))
            
        callback_url = url_for('ecosystem_sso.callback', _external=True)
        if 'mindstack.click' in callback_url:
            callback_url = callback_url.replace('http://', 'https://')
            
        result = auth.handle_callback(code, callback_url=callback_url)
        if not result['success']:
            return f"SSO Error: {result.get('error')}", 400
            
        user = on_user_provision(result['user'], result['tokens'])
        return login_success_redirect_fn(user, result['tokens'])

    @bp.route('/auth-center/webhook/backchannel-log', methods=['POST'])
    def backchannel_logout():
        # Standard implementation for global logout notification
        return jsonify({"success": True}), 200

    return bp, auth
