# -*- coding: utf-8 -*-
# backend/database_local.py
import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# ── 1. DYNAMIC ACCESS PATH RESOLUTION ─────────────────────────────────────
if getattr(sys, 'frozen', False):
    # Running inside the compiled PyInstaller .exe environment
    # Forces the database out of the restricted Program Files folder into Roaming AppData
    appdata_dir = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), "MiBot_Desktop")
    os.makedirs(appdata_dir, exist_ok=True)
    DB_PATH = os.path.join(appdata_dir, "mibot_local_workspace.db")
else:
    # Running locally inside your development environment (VS Code)
    base_path = os.path.dirname(os.path.abspath(__file__))
    DB_PATH = os.path.join(base_path, "mibot_local_workspace.db")

# ── 2. WINDOWS ABSOLUTE PATH STANDARDIZATION ──────────────────────────────
# Convert Windows backslashes (\) to forward slashes (/) to prevent string escape bugs
clean_db_path = DB_PATH.replace("\\", "/")

# Strip any erroneous leading slashes to prevent a 4-slash format crash
clean_db_path = clean_db_path.lstrip("/")

# Enforce the strict 3 forward slashes rule for Windows Absolute Drive Paths (sqlite:///C:/...)
DATABASE_URL = f"sqlite:///{clean_db_path}"

# ── 3. SQLITE ENGINE INITIALIZATION ───────────────────────────────────────
engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False}  # Allows safe concurrent execution across background threads
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_local_db():
    """Context yield generator for isolated local transaction blocks."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()