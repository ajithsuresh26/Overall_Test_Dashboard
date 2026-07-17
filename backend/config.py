# -*- coding: utf-8 -*-
# backend/config.py
import os
from dotenv import load_dotenv

load_dotenv()

# Admin Side Server for proxy authentication and profile tracking
VPS_ADMIN_API_URL = "https://qairosolution.com"

# Fresh production Enterprise layers for loading real-time anomalies data
QAIRO_BASE_URL = os.getenv("QAIRO_BASE_URL", "https://mx.qairosolution.com")
QAIRO_CLIENT_KEY = os.getenv("QAIRO_CLIENT_KEY", "anomaly_service_prod_8f2b7a91c4e5d6f3")

# Port definitions
PORT_BACKEND_FASTAPI = 5001
PORT_UDP_BEACON = 5555