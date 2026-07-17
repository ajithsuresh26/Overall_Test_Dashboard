# -*- coding: utf-8 -*-
# backend/router_robots.py
import os
import time
import base64
import socket
import requests
import re
import aiosmtplib
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from datetime import datetime
from fastapi import APIRouter, Request, HTTPException, Depends, status
from sqlalchemy.orm import Session
from database_local import get_local_db
from cryptography.fernet import Fernet
from Crypto.Cipher import AES
from qairo_service import QairoService
from config import VPS_ADMIN_API_URL
import models_local

router = APIRouter(tags=["Operational Telemetry & Robot Stream Gates"])

CONNECTED_ROBOTS_REGISTRY = {}
qairo_service = QairoService()

ENCRYPTION_KEY = "3b0hW8v8X5M4_Z2f6v9K3X1z_v0B8N7m6L5k4J3h2G1="
cipher_suite = Fernet(ENCRYPTION_KEY.encode())

# ── QAIRO IMAGE ENCRYPTION ──────────────────────────────────────────────────
QAIRO_IMAGE_AES_KEY_HEX = "34e66a1952e7f726e057a543bbd700a4555327918ba22909a1b84a848c1c23a4"
QAIRO_IMAGE_AES_KEY = bytes.fromhex(QAIRO_IMAGE_AES_KEY_HEX)


def looks_like_image_bytes(data: bytes) -> bool:
    """Cheap magic-byte sniff so we don't accidentally treat encrypted
    ciphertext (or an error page) as a valid image."""
    if not data or len(data) < 12:
        return False
    if data[:3] == b"\xff\xd8\xff":                      # JPEG
        return True
    if data[:8] == b"\x89PNG\r\n\x1a\n":                  # PNG
        return True
    if data[:6] in (b"GIF87a", b"GIF89a"):                # GIF
        return True
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":     # WEBP
        return True
    return False


def decrypt_qairo_image(raw_bytes: bytes):
    """
    Attempt to AES-256-EAX decrypt a Qairo anomaly image payload laid out as
    nonce(16) + tag(16) + ciphertext. Returns decrypted bytes on success,
    or None if the payload isn't in this format / decryption fails.
    """
    try:
        if not raw_bytes or len(raw_bytes) <= 32:
            return None
        nonce = raw_bytes[:16]
        tag = raw_bytes[16:32]
        ciphertext = raw_bytes[32:]
        cipher = AES.new(QAIRO_IMAGE_AES_KEY, AES.MODE_EAX, nonce=nonce)
        plaintext = cipher.decrypt_and_verify(ciphertext, tag)
        return plaintext
    except Exception as e:
        print(f"⚠️ QAIRO_IMAGE_DECRYPT_FAIL: {e}")
        return None


def detect_image_subtype(data: bytes):
    """
    Explicit magic-byte based subtype detection for MIMEImage's `_subtype`
    argument.
    """
    if not data or len(data) < 12:
        return None
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def resolve_image_bytes(raw_bytes: bytes):
    """
    Given raw bytes fetched from a Qairo image reference, return bytes
    that are actually renderable as an image.
    """
    if looks_like_image_bytes(raw_bytes):
        return raw_bytes

    decrypted = decrypt_qairo_image(raw_bytes)
    if decrypted and looks_like_image_bytes(decrypted):
        return decrypted

    return None


def safe_normalize_timestamp(item):
    """
    Extracts and normalizes timelines coming from both local cache structures
    and the main_code pipeline.
    """
    raw_time = (
        item.get("observation_date") or
        item.get("timestamp") or
        item.get("created_at") or
        item.get("logged_at") or
        item.get("detected_at")
    )

    if not raw_time:
        for k, v in item.items():
            if "date" in k.lower() or "time" in k.lower():
                raw_time = v
                break

    if not raw_time:
        return int(time.time() * 1000)

    if isinstance(raw_time, (int, float)):
        if raw_time < 10000000000:
            return int(raw_time * 1000)
        return int(raw_time)

    try:
        clean_str = str(raw_time).strip()

        if "+" in clean_str:
            clean_str = clean_str.split("+")[0]
        elif "-" in clean_str and clean_str.count("-") > 2:
            r_split = clean_str.rsplit("-", 1)
            if ":" in r_split[1]:
                clean_str = r_split[0]

        clean_str = clean_str.replace("Z", "").split(".")[0].strip()

        formats = (
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%Y-%m-%d"
        )

        for fmt in formats:
            try:
                dt = datetime.strptime(clean_str, fmt)
                return int(dt.timestamp() * 1000)
            except ValueError:
                continue
    except Exception:
        pass

    return int(time.time() * 1000)


def extract_image_reference(item):
    """
    Qairo (and similar third-party APIs) don't always use the same key
    for the image field.
    """
    candidates = (
        "image_url", "image", "photo_url", "photo", "frame_url",
        "capture_url", "snapshot", "snapshot_url", "picture",
        "media_url", "thumbnail_url", "asset_url"
    )
    for key in candidates:
        val = item.get(key)
        if val:
            return val

    for k, v in item.items():
        if v and isinstance(v, str) and any(tok in k.lower() for tok in ("image", "photo", "frame", "snapshot", "capture", "thumbnail")):
            return v

    return None


# ── SMTP CONNECTIVITY PROBE ─────────────────────────────────────────────────
def probe_smtp_port(host: str, port: int, timeout: float = 5.0):
    """
    Raw TCP connect test — no TLS, no auth. Tells you in a few seconds
    whether the port is even reachable, before wasting 12-15s waiting
    on aiosmtplib to time out. Distinguishes DNS failure, firewall/timeout,
    and active refusal so the error message actually points at the cause.
    """
    host = (host or "").strip()
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return {"reachable": True, "detail": f"TCP connect to {host}:{port} succeeded."}
    except socket.gaierror as e:
        return {"reachable": False, "detail": f"DNS resolution failed for '{host}': {e}"}
    except (socket.timeout, TimeoutError):
        return {
            "reachable": False,
            "detail": (
                f"Timed out connecting to {host}:{port} — most likely this server's outbound "
                f"traffic on that port is blocked by a firewall / cloud security group, or the "
                f"mail host is down. Try the alternate port (465 <-> 587) or ask your hosting "
                f"provider to open outbound SMTP."
            ),
        }
    except ConnectionRefusedError:
        return {
            "reachable": False,
            "detail": f"Connection to {host}:{port} was actively refused — the host is reachable "
                      f"but nothing is listening on that port (wrong port number?).",
        }
    except Exception as e:
        return {"reachable": False, "detail": f"Unexpected error connecting to {host}:{port}: {e}"}


# ── 1. ROBOTS FLEET REGISTRY ───────────────────────────────────────────────
@router.get("/robots/")
@router.get("/robots")
def list_local_active_fleet():
    cloud_robots = []
    vps_endpoint = f"{VPS_ADMIN_API_URL}/api/robots/"
    try:
        vps_response = requests.get(vps_endpoint, timeout=5)
        if vps_response.status_code == 200:
            res_data = vps_response.json()
            if isinstance(res_data, dict):
                cloud_robots = res_data.get("data", [])
            elif isinstance(res_data, list):
                cloud_robots = res_data
    except Exception as e:
        print(f"⚠️ FLEET_PROXY WARN: Centralized cloud registry unreachable: {e}")

    merged_fleet = {}
    for r in cloud_robots:
        r_id = r.get("id") or r.get("robot_id")
        if r_id:
            r_id = str(r_id).strip().upper()
            merged_fleet[r_id] = {
                "id": r_id,
                "name": r.get("name", f"Mobility Node {r_id[-4:]}"),
                "is_online": r.get("is_online", True),
                "client_id": str(r.get("client_id", "1")).strip(),
                "battery": r.get("battery", 100),
                "temp": r.get("temp", 42.0),
                "cams": r.get("cams", 4)
            }

    for local_id, local_data in CONNECTED_ROBOTS_REGISTRY.items():
        merged_fleet[local_id.upper()] = local_data
    return list(merged_fleet.values())


# ── 2. DUAL AUTHENTICATION LOCAL STEP 2 HOOK ────────────────────────────────
@router.post("/robot/activate-local")
async def register_local_activation_state(request: Request):
    try:
        payload = await request.json()
        robot_id = payload.get("robot_id", "").strip().upper()
        if not robot_id:
            raise HTTPException(status_code=400, detail="Invalid robot identifier context")
        incoming_client_id = str(payload.get("client_id", "1")).strip()
        CONNECTED_ROBOTS_REGISTRY[robot_id] = {
            "id": robot_id,
            "name": f"Mobility Node {robot_id[-4:] if len(robot_id) > 4 else robot_id}",
            "is_online": True,
            "client_id": incoming_client_id,
            "battery": 100,
            "temp": 45.0,
            "cams": 4
        }
        return {"status": "success", "message": "Activation verified on client app."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 3. CLOUD ANOMALIES PIPELINE WITH FLEXIBLE FALLBACK MAPS ─────────────────
@router.get("/anomaly/client/{client_id}")
async def fetch_client_anomalies(client_id: int, db: Session = Depends(get_local_db)):
    external_anomalies = await qairo_service.get_anomalies()

    if external_anomalies is not None and isinstance(external_anomalies, list):
        normalized_external = []
        for item in external_anomalies:
            assigned_robot = item.get("project_id") or item.get("robot_id") or item.get("robot") or "ROB-NODE-01"
            obs_type = item.get("observation_type") or item.get("type") or "manual alert"
            desc = item.get("description") or item.get("activity") or "Enterprise Data Stream Frame Record."

            img_ref = extract_image_reference(item)
            if not img_ref:
                print(f"⚠️ QAIRO_NO_IMAGE_FIELD: anomaly_id={item.get('id')} keys={list(item.keys())}")

            detected_time = safe_normalize_timestamp(item)

            normalized_external.append({
                "id": item.get("id"),
                "robot_id": str(assigned_robot).strip().upper(),
                "type": obs_type.lower().strip(),
                "description": desc,
                "image_url": img_ref,
                "confidence": item.get("confidence", 0.95),
                "timestamp": detected_time
            })
        return {
            "status": "success",
            "source": "mx.qairosolution.com",
            "count": len(normalized_external),
            "anomalies": normalized_external
        }

    anomalies = db.query(models_local.LocalAnomaly).order_by(models_local.LocalAnomaly.id.desc()).all()
    decrypted_list = []
    for a in anomalies:
        decrypted_image = None
        if a.image_url:
            try:
                if "data:image" in str(a.image_url):
                    decrypted_image = a.image_url
                else:
                    encrypted_bytes = base64.b64decode(a.image_url.encode("utf-8"))
                    decrypted_bytes = cipher_suite.decrypt(encrypted_bytes)
                    decrypted_image = f"data:image/jpeg;base64,{base64.b64encode(decrypted_bytes).decode('utf-8')}"
            except Exception:
                decrypted_image = a.image_url

        record_timestamp = int(time.time() * 1000)
        if hasattr(a, "timestamp") and a.timestamp:
            if isinstance(a.timestamp, datetime):
                record_timestamp = int(a.timestamp.timestamp() * 1000)
            else:
                record_timestamp = safe_normalize_timestamp({"timestamp": a.timestamp})

        decrypted_list.append({
            "id": a.id,
            "robot_id": a.robot_id,
            "type": a.type,
            "description": a.description,
            "image_url": decrypted_image,
            "timestamp": record_timestamp,
        })
    return {
        "status": "success",
        "source": "local_cache",
        "count": len(decrypted_list),
        "anomalies": decrypted_list
    }


# ── 3b. DEBUG: DIAGNOSE AN ANOMALY IMAGE_URL WITHOUT SENDING ANY EMAIL ──────
@router.get("/debug/image-check")
async def debug_image_check(image_url: str):
    report = {
        "input_url": image_url,
        "steps": []
    }

    raw_str = str(image_url).strip()

    if not (raw_str.startswith("http://") or raw_str.startswith("https://")):
        report["steps"].append({"step": "url_check", "result": "NOT_A_URL",
                                 "detail": "image_url doesn't start with http(s)://"})
        return report

    try:
        img_domain = raw_str.split("/")[2]
    except Exception:
        img_domain = ""

    browser_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Referer": f"https://{img_domain}/" if img_domain else "",
    }

    try:
        img_resp = requests.get(raw_str, headers=browser_headers, timeout=12, allow_redirects=True)
    except Exception as e:
        report["steps"].append({"step": "fetch", "result": "EXCEPTION", "detail": str(e)})
        return report

    content = img_resp.content or b""
    report["steps"].append({
        "step": "fetch",
        "result": "OK" if img_resp.status_code == 200 else "BAD_STATUS",
        "status_code": img_resp.status_code,
        "final_url": img_resp.url,
        "redirected": img_resp.url != raw_str,
        "content_type": img_resp.headers.get("Content-Type", ""),
        "content_length_bytes": len(content),
        "first_32_bytes_hex": content[:32].hex() if content else "",
    })

    if img_resp.status_code != 200 or not content:
        report["conclusion"] = "Qairo/host rejected the server-side fetch."
        return report

    is_valid_as_downloaded = looks_like_image_bytes(content)
    report["steps"].append({"step": "magic_byte_check", "is_valid_image_as_downloaded": is_valid_as_downloaded})

    resolved = resolve_image_bytes(content)
    report["steps"].append({
        "step": "resolve_image_bytes",
        "resolved_to_valid_image": resolved is not None,
        "resolved_length_bytes": len(resolved) if resolved else 0,
        "resolved_subtype": detect_image_subtype(resolved) if resolved else None,
    })

    if resolved:
        try:
            debug_dir = "/tmp/qairo_image_debug"
            os.makedirs(debug_dir, exist_ok=True)
            subtype = detect_image_subtype(resolved) or "bin"
            debug_path = os.path.join(debug_dir, f"debug_check_{int(time.time())}.{subtype}")
            with open(debug_path, "wb") as f:
                f.write(resolved)
            report["saved_for_manual_inspection"] = debug_path
        except Exception as e:
            report["save_error"] = str(e)
        report["conclusion"] = "SUCCESS — this URL resolves to a real, valid image on the server side too."
    else:
        report["conclusion"] = "The server downloaded SOMETHING but it is not a valid image."

    return report


# ── 3c. DEBUG: RAW TCP SMTP PORT CONNECTIVITY CHECK (NO AUTH, NO EMAIL) ─────
@router.get("/debug/smtp-check")
def debug_smtp_check(host: str, port: int):
    """
    Fast connectivity-only diagnostic. Hit this BEFORE the full auth test to
    quickly tell apart "port blocked by firewall" from "bad credentials".
    Example: GET /api/debug/smtp-check?host=smtp.hostinger.com&port=465
    """
    clean_host = (host or "").strip()
    clean_port = int(port)
    result = probe_smtp_port(clean_host, clean_port)
    return {"host": clean_host, "port": clean_port, **result}


def execute_smtp_email_broadcast(cfg_data: dict, recipient_email: str, html_body: str, alert_subject: str):
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = alert_subject
        msg["From"] = f"{cfg_data['sender_name']} <{cfg_data['smtp_user']}>"
        msg["To"] = recipient_email

        part_html = MIMEText(html_body, "html", "utf-8")
        msg.attach(part_html)

        server = smtplib.SMTP(cfg_data["smtp_host"], cfg_data["smtp_port"], timeout=10)
        if cfg_data.get("use_tls"):
            server.starttls()

        server.login(cfg_data["smtp_user"], cfg_data["smtp_pass"])
        server.sendmail(cfg_data["smtp_user"], recipient_email, msg.as_string())
        server.quit()
        print(f"✅ [SMTP SUCCESS]: Alert broadcast completed for {recipient_email}")
        return True
    except Exception as smtp_err:
        print(f"❌ [SMTP FAILURE]: Handshake failed for host {cfg_data.get('smtp_host')}: {smtp_err}")
        return False


# ── 4. DISPATCH ALERTS WITH TEAM VERIFIED MESSAGE-CLIENT SMTP WRAPPERS ──
@router.post("/alerts/trigger")
async def trigger_officer_alerts(request: Request, db: Session = Depends(get_local_db)):
    try:
        payload = await request.json()
        client_id = payload.get("client_id", 1)
        robot_id = payload.get("robot_id", "ROB-NODE-01").strip().upper()

        raw_types = payload.get("types") or payload.get("type") or ["Manual Alert"]
        if isinstance(raw_types, str):
            types_list = [raw_types]
        else:
            types_list = list(raw_types)

        detection_type = ", ".join(types_list)
        description = payload.get("description", "Panic Signal Triggered From Dashboard Menu.")
        image_url = payload.get("image_url")

        target_officer_ids = payload.get("target_officer_ids")
        officers = db.query(models_local.LocalSafetyOfficer).filter(models_local.LocalSafetyOfficer.client_id == client_id).all()

        if target_officer_ids is not None:
            target_ids_set = set(int(x) for x in target_officer_ids if str(x).isdigit())
            officers = [o for o in officers if o.id in target_ids_set]

        cfg = db.query(models_local.LocalClientEmailConfig).filter(models_local.LocalClientEmailConfig.client_id == client_id).first()

        notified_count = 0
        if cfg and cfg.smtp_user and cfg.smtp_pass:
            for officer in officers:
                if officer.email:
                    try:
                        msg = MIMEMultipart("related")
                        msg["Subject"] = f"🚨 MiBOT CRITICAL THREAT ALERT: {detection_type.upper()} [{robot_id}]"
                        msg["From"] = f"{cfg.sender_name} <{cfg.smtp_user}>"
                        msg["To"] = officer.email

                        msg_alternative = MIMEMultipart("alternative")
                        msg.attach(msg_alternative)

                        image_attached = False
                        image_data_uri = None
                        if image_url:
                            try:
                                raw_str = str(image_url).strip()
                                image_bytes = None

                                if raw_str.startswith("http://") or raw_str.startswith("https://"):
                                    try:
                                        img_domain = raw_str.split("/")[2]
                                    except Exception:
                                        img_domain = ""
                                    browser_headers = {
                                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
                                        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                                        "Referer": f"https://{img_domain}/" if img_domain else "",
                                    }
                                    img_resp = requests.get(raw_str, headers=browser_headers, timeout=12, allow_redirects=True)
                                    if img_resp.status_code == 200 and img_resp.content:
                                        image_bytes = img_resp.content
                                else:
                                    if len(raw_str) > 100:
                                        if "base64," in raw_str:
                                            base64_clean = raw_str.split("base64,")[1].strip()
                                        else:
                                            base64_clean = raw_str
                                        base64_clean = base64_clean.replace(" ", "+").replace("\n", "").replace("\r", "")
                                        missing_padding = len(base64_clean) % 4
                                        if missing_padding:
                                            base64_clean += "=" * (4 - missing_padding)
                                        image_bytes = base64.b64decode(base64_clean)

                                if image_bytes:
                                    resolved_bytes = resolve_image_bytes(image_bytes)
                                    image_bytes = resolved_bytes

                                if image_bytes:
                                    subtype = detect_image_subtype(image_bytes)
                                    if subtype is not None:
                                        msg_image_inline = MIMEImage(image_bytes, _subtype=subtype)
                                        msg_image_inline.add_header("Content-ID", "<anomaly_frame_payload>")
                                        msg_image_inline.add_header("Content-Disposition", "inline", filename=f"capture.{subtype}")
                                        msg.attach(msg_image_inline)

                                        msg_image_attachment = MIMEImage(image_bytes, _subtype=subtype)
                                        msg_image_attachment.add_header("Content-Disposition", "attachment", filename=f"anomaly_capture_{robot_id}.{subtype}")
                                        msg.attach(msg_image_attachment)

                                        image_attached = True
                                        image_data_uri = f"data:image/{subtype};base64,{base64.b64encode(image_bytes).decode('ascii')}"
                            except Exception as img_err:
                                print(f"❌ SMTP_IMAGE_ATTACH_FAIL robot={robot_id}: {img_err}")

                        html_body = f"""
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                            <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
                            <style>
                              html, body {{ margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f8fafc; }}
                              table {{ border-spacing: 0; border-collapse: collapse; width: 100%; }}
                              .container {{ width: 100% !important; max-width: 600px !important; margin: 0 auto !important; padding: 10px !important; }}
                              @media only screen and (max-width: 600px) {{
                                .container {{ width: 100% !important; padding: 0 !important; }}
                                .inner-box {{ border-radius: 0px !important; }}
                              }}
                            </style>
                          </head>
                          <body style="margin: 0; padding: 0; width: 100%; background-color: #f8fafc; font-family: 'Segoe UI', system-ui, sans-serif;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; width: 100%;">
                              <tr>
                                <td align="center" style="padding: 10px 0;">
                                  <div class="container" style="max-width: 600px; width: 100%;">
                                    <table class="inner-box" role="presentation" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); width: 100%;">
                                      <tr>
                                        <td style="background-color: #0f172a; padding: 25px 20px; text-align: center; border-bottom: 4px solid #ef4444;">
                                          <h1 style="color: #ffffff; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin: 0;">
                                            🚨 Autonomous Threat Warning Signal
                                          </h1>
                                        </td>
                                      </tr>
                                      <tr>
                                        <td style="padding: 24px;">
                                          <p style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 16px 0;">
                                            Security Matrix Metrics Pipeline:
                                          </p>
                                          <table role="presentation" style="width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed;">
                                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                              <td style="padding: 12px 0; color: #94a3b8; font-weight: 700; width: 35%;">UNIT NODE ID</td>
                                              <td style="padding: 12px 0; color: #0f172a; font-weight: 800; font-family: monospace; font-size: 14px; word-break: break-all;">{robot_id}</td>
                                            </tr>
                                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                              <td style="padding: 12px 0; color: #94a3b8; font-weight: 700;">VIOLATION CLASS</td>
                                              <td style="padding: 12px 0; color: #dc2626; font-weight: 800; text-transform: uppercase;">{detection_type}</td>
                                            </tr>
                                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                              <td style="padding: 12px 0; color: #94a3b8; font-weight: 700;">TIMESTAMP</td>
                                              <td style="padding: 12px 0; color: #334155; font-weight: 500;">{datetime.now().strftime('%Y-%m-%d %H:%M:%S IST')}</td>
                                            </tr>
                                            <tr>
                                              <td style="padding: 12px 0; color: #94a3b8; font-weight: 700; vertical-align: top;">INCIDENT DETAILS</td>
                                              <td style="padding: 12px 0; color: #475569; font-weight: 500; line-height: 1.5; word-break: break-word;">{description}</td>
                                            </tr>
                                                    
                                            </div>
                                            </td>
                                        </tr>
                                        </table>
                                    </body>
                                    </html>
                                    
                        """
                        msg_html = MIMEText(html_body, "html")
                        msg_alternative.attach(msg_html)

                        # Parse manually entered port values dynamically
                        target_port = int(cfg.smtp_port) if cfg.smtp_port else 587
                        is_implicit_tls = True if target_port == 465 else False

                        # start_tls=False disables aiosmtplib's automatic
                        # opportunistic STARTTLS during connect() so the
                        # manual starttls() call below doesn't collide with
                        # an already-upgraded connection (see note in
                        # test_local_email_handshake for the full explanation).
                        smtp_client = aiosmtplib.SMTP(
                            hostname=cfg.smtp_host,
                            port=target_port,
                            use_tls=is_implicit_tls,
                            start_tls=False,
                            timeout=15.0
                        )
                        await smtp_client.connect()

                        # Fix context mismatches on implicit vs explicit TLS handshakes
                        if not is_implicit_tls and (target_port == 587 or cfg.use_tls):
                            await smtp_client.starttls()

                        if cfg.smtp_pass:
                            await smtp_client.login(cfg.smtp_user, cfg.smtp_pass)

                        await smtp_client.send_message(msg)
                        await smtp_client.quit()
                        notified_count += 1

                        log_entry = models_local.LocalAlertLog(
                            robot_id=robot_id, client_id=client_id, officer_id=officer.id,
                            channel="email", recipient=officer.email, status="sent"
                        )
                        db.add(log_entry)
                    except Exception as email_err:
                        print(f"❌ SMTP transmission failure down pipeline: {email_err}")

        db.commit()
        return {"status": "success", "officers_notified": notified_count}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/telemetry/log")
async def receive_local_telemetry(request: Request):
    try:
        payload = await request.json()
        robot_id = payload.get("robot_id", "").strip().upper()
        if not robot_id:
            raise HTTPException(status_code=400, detail="Missing parameter descriptors")
        incoming_client_id = str(payload.get("client_id", "1")).strip()
        CONNECTED_ROBOTS_REGISTRY[robot_id] = {
            "id": robot_id,
            "name": f"Mobility {robot_id[-4:] if len(robot_id) > 4 else robot_id}",
            "is_online": True,
            "client_id": incoming_client_id,
            "battery": payload.get("battery", 100),
            "temp": payload.get("temp", 45.0),
            "cams": payload.get("cams", 4)
        }
        return {"status": "telemetry_logged_locally"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 5. REAL SMTP HANDSHAKE AUTHENTICATION GATEWAYS ──────────────────────────
@router.get("/alerts/email-config/{client_id}")
def get_local_email_config(client_id: int, db: Session = Depends(get_local_db)):
    cfg = db.query(models_local.LocalClientEmailConfig).filter(models_local.LocalClientEmailConfig.client_id == client_id).first()
    if cfg:
        return {
            "smtp_host": cfg.smtp_host, "smtp_port": cfg.smtp_port,
            "smtp_user": cfg.smtp_user, "sender_name": cfg.sender_name, "use_tls": cfg.use_tls
        }
    return {"smtp_host": "smtp.gmail.com", "smtp_port": 587, "smtp_user": "", "sender_name": "Safety Alert", "use_tls": True}


@router.post("/alerts/email-config")
async def save_local_email_config(request: Request, client_id: int, db: Session = Depends(get_local_db)):
    try:
        form_data = await request.json()
        cfg = db.query(models_local.LocalClientEmailConfig).filter(models_local.LocalClientEmailConfig.client_id == client_id).first()
        if not cfg:
            cfg = models_local.LocalClientEmailConfig(client_id=client_id)
            db.add(cfg)
            
        cfg.smtp_host = (form_data.get("smtp_host") or "").strip()
        cfg.smtp_port = int(form_data.get("smtp_port", 587)) if form_data.get("smtp_port") else 587
        cfg.smtp_user = (form_data.get("smtp_user") or "").strip()
        cfg.sender_name = form_data.get("sender_name", "Safety Alert")
        cfg.use_tls = form_data.get("use_tls", True)
        
        # intercept proxy value and skip mutating database row value if unchanged
        incoming_pass = (form_data.get("smtp_pass") or "").strip()
        if incoming_pass != "KEEP_EXISTING_PASSWORD":
            cfg.smtp_pass = incoming_pass

        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/email-config/test/{client_id}")
async def test_local_email_handshake(client_id: int, test_recipient: str, request: Request, db: Session = Depends(get_local_db)):
    try:
        form_data = await request.json()

        host = (form_data.get("smtp_host") or "").strip()
        port = int(form_data.get("smtp_port", 587)) if form_data.get("smtp_port") else 587
        user = (form_data.get("smtp_user") or "").strip()
        password = (form_data.get("smtp_pass") or "").strip()
        use_tls = form_data.get("use_tls", True)
        test_recipient = (test_recipient or "").strip()

        # If frontend passed the token, extract the active password value safely out of the local cache array
        if password == "KEEP_EXISTING_PASSWORD":
            saved_cfg = db.query(models_local.LocalClientEmailConfig).filter(models_local.LocalClientEmailConfig.client_id == client_id).first()
            if saved_cfg and saved_cfg.smtp_pass:
                password = saved_cfg.smtp_pass
            else:
                raise HTTPException(status_code=400, detail="No existing database credentials found to verify.")

        if not host or not user or not password:
            raise HTTPException(status_code=400, detail="Host, username, and credentials payload are required fields.")

        # ── FAST PRE-CHECK ──
        probe = probe_smtp_port(host, port, timeout=5.0)
        if not probe["reachable"]:
            raise HTTPException(
                status_code=504,
                detail=f"Network unreachable before authentication was attempted: {probe['detail']}"
            )

        is_implicit_tls = True if port == 465 else False

        smtp_client = aiosmtplib.SMTP(
            hostname=host,
            port=port,
            use_tls=is_implicit_tls,
            start_tls=False,
            timeout=12.0
        )
        await smtp_client.connect()

        if not is_implicit_tls and (port == 587 or use_tls):
            await smtp_client.starttls()

        try:
            await smtp_client.login(user, password)
        except aiosmtplib.SMTPAuthenticationError as auth_err:
            try:
                await smtp_client.quit()
            except Exception:
                pass
            raise HTTPException(
                status_code=401,
                detail=f"SMTP authentication failed ({auth_err.code}: {auth_err.message}). Check app credentials and whitespace boundaries."
            )

        msg = MIMEText("This is an automated system handshake test verifying your local application outgoing security configuration arrays passed validation.")
        msg["Subject"] = "✅ MiBOT SMTP Handshake Successful"
        msg["From"] = user
        msg["To"] = test_recipient
        await smtp_client.send_message(msg)
        await smtp_client.quit()

        return {"status": "sent", "to": test_recipient}

    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


# ── 6. SAFETY OFFICERS REGISTRY ─────────────────────────────────────────────
@router.get("/alerts/officers/{client_id}")
def get_local_safety_officers(client_id: int, db: Session = Depends(get_local_db)):
    officers = db.query(models_local.LocalSafetyOfficer).filter(models_local.LocalSafetyOfficer.client_id == client_id).all()
    return [{"id": o.id, "client_id": o.client_id, "name": o.name, "role": o.role, "email": o.email} for o in officers]


@router.post("/alerts/officers")
def create_local_safety_officer(form_data: dict, db: Session = Depends(get_local_db)):
    try:
        new_officer = models_local.LocalSafetyOfficer(
            client_id=form_data.get("client_id"), name=form_data.get("name"), role=form_data.get("role", "Safety Officer"), email=form_data.get("email")
        )
        db.add(new_officer)
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/alerts/officers/{officer_id}")
def update_local_safety_officer(officer_id: int, form_data: dict, db: Session = Depends(get_local_db)):
    """
    Edits an existing safety officer profile. The dashboard's OfficerPanel
    edit flow calls PUT here — this route was previously missing, which is
    why edits were coming back as 405 Method Not Allowed.
    """
    try:
        officer_record = db.query(models_local.LocalSafetyOfficer).filter(models_local.LocalSafetyOfficer.id == officer_id).first()

        if not officer_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Update failed: Safety Officer with ID [{officer_id}] does not exist in local cache arrays."
            )

        if "name" in form_data:
            officer_record.name = form_data.get("name")
        if "role" in form_data:
            officer_record.role = form_data.get("role", "Safety Officer")
        if "email" in form_data:
            officer_record.email = form_data.get("email")

        db.commit()
        return {"status": "success", "message": f"Officer entry {officer_id} updated cleanly."}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database atomic mutation loop error: {str(e)}"
        )


@router.delete("/alerts/officers/{officer_id}")
def delete_local_safety_officer(officer_id: int, db: Session = Depends(get_local_db)):
    """
    Safely purges an active security officer profile from the local database workspace
    along with any associated alert cascade histories.
    """
    try:
        officer_record = db.query(models_local.LocalSafetyOfficer).filter(models_local.LocalSafetyOfficer.id == officer_id).first()

        if not officer_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Deletion failed: Safety Officer with ID [{officer_id}] does not exist in local cache arrays."
            )

        db.delete(officer_record)
        db.commit()

        print(f"🗑️ SYSTEM UPDATE: Purged safety officer profile ID [{officer_id}] successfully from local state database.")
        return {"status": "success", "message": f"Officer entry {officer_id} removed cleanly."}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database atomic mutation loop error: {str(e)}"
        )


@router.get("/alerts/logs/{client_id}")
def get_local_alert_logs(client_id: int, db: Session = Depends(get_local_db)):
    logs = db.query(models_local.LocalAlertLog).filter(models_local.LocalAlertLog.client_id == client_id).order_by(models_local.LocalAlertLog.id.desc()).all()
    return [{"id": log.id, "robot_id": log.robot_id, "client_id": log.client_id, "channel": log.channel, "recipient": log.recipient, "status": log.status, "sent_at": log.sent_at} for log in logs]