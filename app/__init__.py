from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
from contextlib import asynccontextmanager

from .core.config import settings
from .core.database import engine, Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic - Automatically create all database tables (including sso_settings)
    from app.modules.sso_module.models import SSOConfig
    Base.metadata.create_all(bind=engine)
    yield
    # Shutdown logic

def create_app() -> FastAPI:
    app = FastAPI(
        title="PodLearn API",
        description="Headless API for PodLearn",
        version="2.0.0",
        lifespan=lifespan
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Global Error Handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        # Determine status code
        status_code = 500
        if hasattr(exc, "status_code"):
            status_code = exc.status_code
        
        return JSONResponse(
            status_code=status_code,
            content={
                "status": "error",
                "code": status_code,
                "message": str(exc)
            }
        )

    # Module Router Registration
    from app.modules.identity.routes import router as identity_router
    from app.modules.content.routes import router as content_router
    from app.modules.engagement.routes import router as engagement_router
    from app.modules.study.routes import router as study_router, tracking_router
    from app.modules.admin.routes import router as admin_router

    app.include_router(identity_router)
    app.include_router(content_router)
    app.include_router(engagement_router)
    app.include_router(study_router)
    app.include_router(tracking_router)
    app.include_router(admin_router)

    # Standardized SSO Module Router (No Prefix)
    from app.modules.sso_module import sso_api_router
    app.include_router(sso_api_router)

    # SPA catch-all and static files
    base_dir = os.path.abspath(os.path.dirname(__file__))
    dist_folder = os.path.join(base_dir, 'core', 'static', 'dist')
    
    if os.path.exists(dist_folder):
        app.mount("/static/dist", StaticFiles(directory=dist_folder), name="static")

    @app.get("/{path:path}")
    async def serve_spa(path: str):
        if path.startswith("api/") or path.startswith("media/"):
             return JSONResponse(status_code=404, content={"status": "error", "message": "API not found"})
        
        # Check if file exists in dist
        file_path = os.path.join(dist_folder, path)
        if path and os.path.isfile(file_path):
            return FileResponse(file_path)
            
        # Admin handle
        if path == "admin" or path.startswith("admin/"):
            admin_index = os.path.join(dist_folder, "admin.html")
            if os.path.exists(admin_index):
                return FileResponse(admin_index)
                
        # Default index
        index_path = os.path.join(dist_folder, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
            
        return JSONResponse(status_code=404, content={"status": "error", "message": "SPA Assets not found"})

    return app

# For uvicorn and worker
app = create_app()
from .core.celery_app import celery_app
