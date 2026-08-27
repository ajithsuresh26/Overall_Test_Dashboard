# backend/config.py
import os
import sys
from dotenv import load_dotenv

# ── DYNAMIC .ENV RESOLUTION FOR PYINSTALLER EXE ─────────────────────────────
if getattr(sys, 'frozen', False):
    # Running inside compiled PyInstaller .exe
    base_dir = os.path.dirname(sys.executable)
    meipass_dir = sys._MEIPASS
    
    # Try loading .env from application root folder first, then bundled _MEIPASS
    env_path = os.path.join(base_dir, ".env")
    if not os.path.exists(env_path):
        env_path = os.path.join(meipass_dir, ".env")
else:
    # Running in standard local development environment
    base_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(base_dir, ".env")

# Force load the resolved .env file
load_dotenv(dotenv_path=env_path)

# Fallback explicit defaults
VPS_ADMIN_API_URL = os.getenv("VPS_ADMIN_API_URL", "https://qairosolution.com").rstrip('/')
QAIRO_BASE_URL = os.getenv("BASE_URL", "https://test.qairosolution.com").rstrip('/')
QAIRO_CLIENT_KEY = os.getenv("CLIENT_KEY", "anomaly_service_prod_8f2b7a91c4e5d6f3")

PORT_BACKEND_FASTAPI = int(os.getenv("PORT_BACKEND_FASTAPI", 5001))
PORT_UDP_BEACON = int(os.getenv("PORT_UDP_BEACON", 5555))