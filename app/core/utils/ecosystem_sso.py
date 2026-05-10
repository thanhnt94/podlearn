from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import RedirectResponse
import requests
import urllib.parse
from typing import Callable

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

    def validate_client(self):
        """Validates the client credentials with the Central Auth server."""
        validate_url = f"{self.server_url}/api/auth/validate-client"
        payload = {
            "client_id": self.client_id,
            "client_secret": self.client_secret
        }
        try:
            r = requests.post(validate_url, json=payload, timeout=5)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            return {"success": False, "error": str(e)}

def create_sso_router(server_url: str, client_id: str, client_secret: str, on_user_provision: Callable, login_success_redirect_fn: Callable):
    """
    Factory to create a standardized SSO Router for any satellite app.
    """
    router = APIRouter(prefix="/auth-center")
    auth = EcosystemAuth(server_url, client_id, client_secret)

    @router.get('/login')
    async def login(request: Request):
        # We need to build the callback URL
        # For simplicity, we can use the request URL and replace the path
        base_url = str(request.base_url).rstrip('/')
        callback_url = f"{base_url}/auth-center/callback"
        if 'mindstack.click' in callback_url:
            callback_url = callback_url.replace('http://', 'https://')
        return RedirectResponse(auth.get_login_url(callback_url))

    @router.get('/callback')
    async def callback(request: Request, code: str = None):
        if not code:
            return RedirectResponse(url="/auth-center/login")
            
        base_url = str(request.base_url).rstrip('/')
        callback_url = f"{base_url}/auth-center/callback"
        if 'mindstack.click' in callback_url:
            callback_url = callback_url.replace('http://', 'https://')
            
        result = auth.handle_callback(code, callback_url=callback_url)
        if not result['success']:
            raise HTTPException(status_code=400, detail=f"SSO Error: {result.get('error')}")
            
        user = await on_user_provision(result['user'], result['tokens'])
        return await login_success_redirect_fn(request, user, result['tokens'])

    @router.post('/webhook/backchannel-log')
    async def backchannel_logout():
        return {"success": True}

    return router, auth
