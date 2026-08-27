# -*- coding: utf-8 -*-
# backend/qairo_service.py
import httpx
import time
import logging
from typing import Optional, List, Dict, Any
from config import QAIRO_BASE_URL, QAIRO_CLIENT_KEY

logger = logging.getLogger("MiBOT-Client.QairoService")

class QairoService:
    def __init__(self):
        self.BASE_URL = QAIRO_BASE_URL
        self.CLIENT_KEY = QAIRO_CLIENT_KEY
        self._token: Optional[str] = None
        self._token_expiry: float = 0

    async def get_auth_token(self) -> Optional[str]:
        """Fetches and caches the API authentication token."""
        if self._token and time.time() < self._token_expiry:
            return self._token

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
                    # Cache token for 55 minutes (3300 seconds)
                    self._token_expiry = time.time() + 3300 
                    return self._token
                
                logger.error(f"⚠️ Token generation failed with status: {resp.status_code}")
                return None
            except Exception as e:
                logger.error(f"❌ Exception during authentication: {str(e)}")
                return None

    def _normalize_anomaly_data(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Ensures every record has a reliable upload/update timestamp string."""
        normalized = []
        for item in items:
            if not isinstance(item, dict):
                continue
            
            # Map potential backend timestamp fields into a single uniform key
            timestamp = (
                item.get("timestamp") 
                or item.get("created_at") 
                or item.get("updated_at") 
                or item.get("uploaded_at") 
                or item.get("time")
            )

            item["timestamp"] = timestamp
            normalized.append(item)

        return normalized

    async def get_anomalies(self, client_id: Optional[int] = None) -> Optional[List[Dict[str, Any]]]:
        """Fetches safety observations filtered by client_id with auth token attached."""
        token = await self.get_auth_token()
        
        headers = {
            "Content-Type": "application/json"
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"

        timeout = httpx.Timeout(30.0, connect=10.0)
        params = {"client_id": client_id} if client_id is not None else {}

        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                url = f"{self.BASE_URL}/api/anomalies"
                logger.info(f"🌐 Fetching live anomaly records for client_id={client_id} from: {url}")
                
                resp = await client.get(url, params=params, headers=headers)
                
                if resp.status_code == 200:
                    res_json = resp.json()
                    raw_records = []

                    if isinstance(res_json, list):
                        raw_records = res_json
                    elif isinstance(res_json, dict):
                        raw_records = (
                            res_json.get("data") 
                            or res_json.get("anomalies") 
                            or res_json.get("items") 
                            or []
                        )

                    return self._normalize_anomaly_data(raw_records)
                
                logger.error(f"❌ Server side validation error: Status {resp.status_code}")
                return None
            except Exception as e:
                logger.error(f"❌ Fatal communication break: {str(e)}")
                return None