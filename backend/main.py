# -*- coding: utf-8 -*-
# backend/main.py
import os
import sys
import logging
from datetime import datetime
from logging.handlers import TimedRotatingFileHandler
from contextlib import asynccontextmanager
import threading
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# --- 0. SILENT CERTIFICATE LAYER ---
try:
    import certifi
    os.environ["SSL_CERT_FILE"] = certifi.where()
    os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()
except Exception:
    pass

# --- 1. PATH RESOLUTION & LOGGING SETUP ---
base_path = os.path.dirname(os.path.abspath(__file__))
log_dir = os.path.join(base_path, "logs")
os.makedirs(log_dir, exist_ok=True)

today_str = datetime.now().strftime("%Y-%m-%d")
LOG_FILE = os.path.join(log_dir, f"app_web_{today_str}.log")

FRONTEND_DIR = os.path.join(base_path, "public")
DB_PATH = os.path.join(base_path, "mibot_local_workspace.db")
os.environ["MIBOT_DB_PATH"] = DB_PATH

log_formatter = logging.Formatter("%(asctime)s - [%(levelname)s] - %(name)s - %(message)s")
file_handler = TimedRotatingFileHandler(
    LOG_FILE, 
    when="midnight", 
    interval=1, 
    backupCount=30, 
    encoding="utf-8"
)
file_handler.setFormatter(log_formatter)

root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)
root_logger.addHandler(file_handler)

logger = logging.getLogger("MiBOT-Web-Server")
logger.info("==================================================")
logger.info("🚀 MiBOT Web Application Server Initializing")
logger.info(f"📂 Current Log Path: {LOG_FILE}")
logger.info("==================================================")

# --- 2. MODULE & ROUTER IMPORTS ---
from config import PORT_BACKEND_FASTAPI
import router_auth
import router_robots
from beacon import router as tracking_router, launch_udp_broadcast_beacon
from sync_service import start_periodic_sync
from database_local import engine
import models_local

models_local.Base.metadata.create_all(bind=engine)

# --- 3. LIFESPAN MANAGEMENT (BACKGROUND THREADS) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start sync service & beacon workers
    threading.Thread(target=launch_udp_broadcast_beacon, daemon=True).start()
    threading.Thread(target=start_periodic_sync, kwargs={"interval_seconds": 30}, daemon=True).start()
    logger.info("✅ Background sync service & beacon threads started.")
    yield
    # Shutdown
    logger.info("🛑 Web server shutting down.")

app = FastAPI(
    title="MiBOT Web Application Portal",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Application Router Mounts
app.include_router(tracking_router)
app.include_router(router_auth.router)
app.include_router(router_auth.router, prefix="/api")  
app.include_router(router_robots.router, prefix="/api")

# --- 4. STATIC FRONTEND SPA SERVING ---
if os.path.exists(FRONTEND_DIR) and os.path.exists(os.path.join(FRONTEND_DIR, "index.html")):
    assets_dir = os.path.join(FRONTEND_DIR, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{catchall:path}")
    async def serve_frontend(catchall: str):
        file_path = os.path.join(FRONTEND_DIR, catchall)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
else:
    @app.get("/")
    async def server_status():
        return {"status": "online", "message": "MiBOT Web Backend API is active."}

# --- 5. APPLICATION ENTRY POINT ---
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",  # Required for web/cloud access
        port=PORT_BACKEND_FASTAPI,
        reload=False
    )