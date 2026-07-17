# -*- coding: utf-8 -*-
# backend/test_manual.py
import requests
import base64
import random
import time
from cryptography.fernet import Fernet

# The FastAPI local dev endpoint matching your backend port configuration
TARGET_URL = "http://127.0.0.1:5001/api/vlm/analyse"

# Fernet Key configuration matching router expectations exactly
KEY = "3b0hW8v8X5M4_Z2f6v9K3X1z_v0B8N7m6L5k4J3h2G1="
cipher = Fernet(KEY.encode())

# A dictionary of real-world industrial anomalies paired with open-source reference image URLs
MOCK_ANOMALIES_POOL = [
    {
        "type": "fire",
        "description": "🔥 CRITICAL ALERT: Thermal sensor anomaly detected. High-probability open flame ignition signature localized in Zone 3 fuel repository container.",
        "image_url": "https://images.unsplash.com/photo-1563914856641-f761fc5903b7?auto=format&fit=crop&w=400&q=80" # Industrial fire/refinery flare
    },
    {
        "type": "smoke",
        "description": "💨 ENVIRONMENTAL NOTICE: Visual smoke dispersion pattern identified via overhead tracking pipeline near manufacturing exhaust manifold.",
        "image_url": "https://images.unsplash.com/photo-1535083783855-76ae62b2914e?auto=format&fit=crop&w=400&q=80" # Industrial factory smoke
    },
    {
        "type": "intrusion",
        "description": "🚨 SECURITY BREACH: Unauthorized personnel movement detected within restricted perimeter boundary zone after operational hours.",
        "image_url": "https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=400&q=80" # Security fence / restricted zone
    },
    {
        "type": "equipment failure",
        "description": "⚡ OPERATIONAL FAILURE: Mechanical conveyor linkage assembly tracking severe misalignment causing frictional overheat signature.",
        "image_url": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80" # Heavy machinery / broken gears
    }
]

def generate_and_send_real_image_anomaly():
    # Pick a random anomaly structure from the pool
    selected_anomaly = random.choice(MOCK_ANOMALIES_POOL)
    
    print(f"🌐 Fetching realistic sample image for [{selected_anomaly['type'].upper()}] from remote server...")
    try:
        # Download the actual image bytes directly from the internet
        img_response = requests.get(selected_anomaly["image_url"], timeout=10)
        if img_response.status_code == 200:
            raw_image_bytes = img_response.content
        else:
            raise Exception("Fallback to placeholder bytes on bad server status")
    except Exception as e:
        print(f"⚠️ Image download timed out or failed ({e}). Falling back to dummy binary pixel stream.")
        raw_image_bytes = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"

    # Encrypt the raw image data cleanly via Fernet symmetric core
    encrypted_bytes = cipher.encrypt(raw_image_bytes)
    encrypted_string = base64.b64encode(encrypted_bytes).decode("utf-8")

    # Build data package payload contract pointing to client room 1
    test_payload = {
        "robot_id": f"ROB-NODE-0{random.randint(1, 4)}",
        "local_detections": [selected_anomaly["type"]],
        "image_b64": encrypted_string,
        "context": {
            "description": selected_anomaly["description"],
            "client_id": "1" 
        }
    }

    # Fire request execution wrapper block
    try:
        response = requests.post(TARGET_URL, json=test_payload, timeout=8)
        print(f"✅ Dispatched and populated dashboard with live image asset! Response: {response.json()}\n")
    except Exception as e:
        print(f"❌ TEST FAILED: Could not reach backend server. Error: {e}\n")

if __name__ == "__main__":
    print("🚀 Starting Live Multi-Anomaly Real-Image Data Stream Test...")
    print("Ensure main.py is listening on port 5001 before starting. Press Ctrl+C to stop.\n")
    
    # Cycles through and posts 4 distinct image packages onto your dashboard canvas
    for i in range(4):
        print(f"--- Running Test Sequence Vector {i+1}/4 ---")
        generate_and_send_real_image_anomaly()
        time.sleep(3.0) # Sits back for 3 seconds between iterations to let the UI fetch updates