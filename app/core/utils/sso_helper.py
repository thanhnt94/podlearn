import requests
try:
    from flask import session, redirect, url_for, request
except ImportError:
    # Support for non-flask environments if needed
    pass

class EcosystemAuth:
    """
    Standardized 'Power Pairing' Helper for Mindstack Satellite Apps.
    Simplifies OAuth2/OIDC flows to a few lines of code.
    """
    def __init__(self, server_url, client_id, client_secret):
        self.server_url = server_url.rstrip('/')
        self.client_id = client_id
        self.client_secret = client_secret

    def get_login_url(self, callback_url):
        """Generates the redirect URL to Central Auth."""
        import urllib.parse
        encoded_callback = urllib.parse.quote(callback_url, safe='')
        return f"{self.server_url}/auth/login?client_id={self.client_id}&redirect_uri={encoded_callback}"

    def handle_callback(self, code):
        """Exchanges authorization code for tokens and fetches user info."""
        # 1. Exchange Code for Tokens
        token_url = f"{self.server_url}/api/auth/token"
        payload = {
            "code": code,
            "client_id": self.client_id,
            "client_secret": self.client_secret
        }
        
        try:
            r = requests.post(token_url, json=payload, timeout=5)
            r.raise_for_status()
            tokens = r.json()
            
            # 2. Verify Token and get Profile
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

    def validate_client(self):
        """Official Handshake: Verifies if the credentials are valid on the server."""
        validate_url = f"{self.server_url}/api/auth/validate-client"
        try:
            r = requests.post(validate_url, json={
                "client_id": self.client_id,
                "client_secret": self.client_secret
            }, timeout=5)
            try:
                data = r.json()
            except:
                print(f"[SSO_HELPER] Hub returned non-JSON response: {r.text[:200]}")
                return {"success": False, "error": f"Hub error (HTTP {r.status_code})"}

            if r.ok and data.get('success'):
                return {"success": True, "client_name": data.get('client_name')}
            return {"success": False, "error": data.get('error', 'Invalid Credentials')}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_logout_url(self, return_to=None):
        """Initiates Global Logout."""
        url = f"{self.server_url}/api/auth/logout"
        if return_to:
            url += f"?return_to={return_to}"
        return url
