# -*- coding: utf-8 -*-
# backend/main.py
import os
import sys
import threading
import logging
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse

# --- 0. SILENT TASK CERTIFICATE FORWARDING LAYER ---
try:
    import certifi
    os.environ["SSL_CERT_FILE"] = certifi.where()
    os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()
except Exception:
    pass

# --- 1. PATH HANDLING FOR STANDARD WEB EXECUTION ---
base_path = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(base_path, "public")
DB_PATH = os.path.join(base_path, "mibot_local_workspace.db")

# Force environmental variable visibility for database modules downstream
os.environ["MIBOT_DB_PATH"] = DB_PATH

# --- 2. NOW SAFELY IMPORT MODULE CORES & ROUTERS ---
from config import PORT_BACKEND_FASTAPI
import router_auth
import router_robots
from beacon import router as tracking_router, launch_udp_broadcast_beacon
from sync_service import start_periodic_sync

# Initialize Local SQLite database structural metadata maps
from database_local import engine
import models_local
models_local.Base.metadata.create_all(bind=engine)

# Logger Configuration Matrix
logger = logging.getLogger("MiBOT-Client")
logger.setLevel(logging.INFO)

if logger.hasHandlers():
    logger.handlers.clear()

if sys.stdout is not None:
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    logger.addHandler(console_handler)

app = FastAPI(
    title="MiBOT Web App Service Core",
    description="Clean Architectural Web-Server Engine Setup Framework."
)

# --- 3. CORS MIDDLEWARE FOR WEB BROWSER COMPATIBILITY ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows perfect loopback connections from your Vite frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Application Router Mount points
app.include_router(tracking_router)
app.include_router(router_auth.router)
app.include_router(router_robots.router, prefix="/api")

# --- 4. STATIC FRONTEND SERVING CORE ---
if os.path.exists(FRONTEND_DIR) and os.path.exists(os.path.join(FRONTEND_DIR, "index.html")):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

    @app.get("/{catchall:path}")
    async def serve_frontend(catchall: str):
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
else:
    @app.get("/")
    async def server_status():
        return {
            "status": "online",
            "message": "MiBOT API Backend running successfully. Ready to accept frontend browser data requests."
        }

# --- 5. SERVER RUNTIME ENTRY LOOP ---
if __name__ == "__main__":
    # Start background industrial telemetry service threads smoothly
    threading.Thread(target=launch_udp_broadcast_beacon, daemon=True).start()
    threading.Thread(target=start_periodic_sync, args=(1, 30), daemon=True).start()
    
    logger.info(f"🔥 SYSTEM_START: API Web Server active on loopback port {PORT_BACKEND_FASTAPI}...")
    
    # Start standard fast-polling Uvicorn app process loop
    uvicorn.run("main:app", host="127.0.0.1", port=PORT_BACKEND_FASTAPI, log_level="info", reload=True)