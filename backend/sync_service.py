# -*- coding: utf-8 -*-
# backend/sync_service.py
import time
import requests
from sqlalchemy.orm import Session
from config import VPS_ADMIN_API_URL
from database_local import SessionLocal
import models_local

def sync_vps_profile_to_local(client_id: int):
    """
    Background worker that polls the VPS Admin API for profile changes
    and synchronizes them into the local SQLite workspace.
    """
    vps_url = f"{VPS_ADMIN_API_URL}/api/clients/{client_id}"
    print(f"🔄 SYNC_SERVICE: Fetching fresh profile data from VPS -> {vps_url}")
    
    try:
        response = requests.get(vps_url, timeout=5)
        if response.status_code == 200:
            # ── SAFE JSON PARSING GUARD ──
            try:
                vps_data = response.json()
            except ValueError:
                print(f"⚠️ SYNC_SERVICE WARN: VPS responded with 200 OK, but payload was not valid JSON text.")
                return

            db: Session = SessionLocal()
            try:
                local_config = db.query(models_local.LocalClientEmailConfig).filter(
                    models_local.LocalClientEmailConfig.client_id == client_id
                ).first()
                
                if local_config:
                    vps_name = vps_data.get("name")
                    if vps_name:
                        local_config.sender_name = f"{vps_name} Safety Alert"
                    db.commit()
                    print(f"✅ SYNC_SERVICE: Local SQLite workspace updated for client {client_id}.")
                else:
                    new_config = models_local.LocalClientEmailConfig(
                        client_id=client_id,
                        sender_name=vps_data.get("name", "Safety Alert")
                    )
                    db.add(new_config)
                    db.commit()
                    print(f"➕ SYNC_SERVICE: Initialized missing local profile matrix for client {client_id}.")
            except Exception as db_err:
                db.rollback()
                print(f"⚠️ SYNC_SERVICE DB ERROR: Failed to commit sync row: {db_err}")
            finally:
                db.close()
        else:
            print(f"⚠️ SYNC_SERVICE WARN: VPS returned unexpected status code {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ SYNC_SERVICE FAILED: Cloud registry unreachable. Operating on offline local cache. Error: {e}")

def start_periodic_sync(interval_seconds: int = 30):
    """Dynamically syncs all clients stored in the local DB without hardcoding."""
    while True:
        db: Session = SessionLocal()
        try:
            configs = db.query(models_local.LocalClientEmailConfig.client_id).all()
            officers = db.query(models_local.LocalSafetyOfficer.client_id).all()
            
            client_ids = set([c[0] for c in configs if c[0]] + [o[0] for o in officers if o[0]])
            
            for c_id in client_ids:
                sync_vps_profile_to_local(c_id)
        except Exception as err:
            print(f"⚠️ SYNC_SERVICE LOOP ERROR: {err}")
        finally:
            db.close()

        time.sleep(interval_seconds)