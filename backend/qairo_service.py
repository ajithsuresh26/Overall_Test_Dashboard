# -*- coding: utf-8 -*-
# backend/qairo_service.py
import httpx
import time
import logging
from config import QAIRO_BASE_URL, QAIRO_CLIENT_KEY

logger = logging.getLogger("MiBOT-Client.QairoService")

class QairoService:
    def __init__(self):
        self.BASE_URL = QAIRO_BASE_URL
        self.CLIENT_KEY = QAIRO_CLIENT_KEY
        self._token = None
        self._token_expiry = 0

    async def get_auth_token(self):
        """Generates or retrieves a cached Bearer token valid for 1 hour."""
        if self._token and time.time() < self._token_expiry:
            return self._token

        logger.info("🔑 Token expired or missing. Executing production secure handshake matrix...")
        timeout = httpx.Timeout(10.0)
        
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                resp = await client.post(
                    f"{self.BASE_URL}/api/token", 
                    json={"client_key": self.CLIENT_KEY}
                )
                
                if resp.status_code == 200:
                    data = resp.json()
                    self._token = data.get("token")
                    self._token_expiry = time.time() + 3300 
                    logger.info("✅ Secure JWT token acquired and cached successfully.")
                    return self._token
                else:
                    logger.error(f"❌ Authorization Handshake Denied by Server: Status {resp.status_code}")
                    return None
            except Exception as e:
                logger.error(f"❌ Connection Handshake Failure to {self.BASE_URL}: {str(e)}")
                return None

    async def get_anomalies(self):
        """Fetches safety observations from mx.qairosolution.com with extreme structural flexibility."""
        token = await self.get_auth_token()
        if not token:
            logger.warning("⚠️ Fetch aborted. Reason: Missing valid authorization token.")
            return None  # Return None on failure to distinguish from a successful empty list []

        timeout = httpx.Timeout(30.0, connect=10.0)
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                url = f"{self.BASE_URL}/api/anomalies"
                logger.info(f"🌐 Fetching live anomaly database records from: {url}")
                resp = await client.get(url, headers=headers)
                
                if resp.status_code == 200:
                    res_json = resp.json()
                    # ── DYNAMIC STRUCTURE UNPACKING ──
                    if isinstance(res_json, list):
                        return res_json
                    if isinstance(res_json, dict):
                        return res_json.get("data") or res_json.get("anomalies") or res_json.get("items") or []
                    return []
                
                logger.error(f"❌ Server side validation error processing dataset request: Status {resp.status_code}")
                return None
            except httpx.ConnectTimeout:
                logger.error("❌ High-Latency Timeout Intercepted: Connection timed out beyond 30-second boundary.")
                return None
            except Exception as e:
                logger.error(f"❌ Fatal communication break along analytics stream pipe: {str(e)}")
                return None