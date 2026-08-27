# -*- coding: utf-8 -*-
# backend/router_auth.py
import logging
import requests
import certifi
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from config import VPS_ADMIN_API_URL

router = APIRouter(tags=["Authentication Matrix"])
logger = logging.getLogger("MiBOT-Client")

# Enforce explicit SSL cert bundle path for PyInstaller
SSL_VERIFY_PATH = certifi.where()

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MiBOT-Desktop-App",
    "Accept": "application/json"
}

class ForgotPasswordPayload(BaseModel):
    email: EmailStr

class VerifyOtpPayload(BaseModel):
    email: EmailStr
    otp: str

class ResetPasswordPayload(BaseModel):
    email: EmailStr
    otp: str
    new_password: str


@router.post("/auth/login")
def desktop_client_login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Relays verification request to central VPS while enforcing client operator restrictions.
    """
    username = form_data.username.strip()
    password = form_data.password.strip()

    vps_payload = {
        "username": username,
        "password": password
    }
    
    # Standardize target URL path
    target_base = VPS_ADMIN_API_URL.rstrip('/') if VPS_ADMIN_API_URL else "https://qairosolution.com"
    vps_endpoint = f"{target_base}/api/auth/login"
    logger.info(f"🔒 PROXY AUTH: Relaying verification request for [{username}] to VPS -> {vps_endpoint}")

    # 1. Dispatch post request with strict and fallback SSL handling
    try:
        vps_response = requests.post(
            vps_endpoint, 
            data=vps_payload, 
            headers=DEFAULT_HEADERS,
            verify=SSL_VERIFY_PATH, 
            timeout=15
        )
    except requests.exceptions.SSLError as ssl_err:
        logger.warning(f"⚠️ PROXY SSL WARN: Cert verification failed ({ssl_err}). Retrying with verify=False...")
        try:
            vps_response = requests.post(
                vps_endpoint, 
                data=vps_payload, 
                headers=DEFAULT_HEADERS, 
                verify=False, 
                timeout=15
            )
        except Exception as retry_err:
            logger.error(f"❌ PROXY FATAL: SSL Fallback failed: {retry_err}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="SSL Handshake Error: Unable to verify connection with qairosolution.com."
            )
    except requests.exceptions.RequestException as req_err:
        logger.error(f"❌ PROXY CONNECTION FAILURE: {req_err}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="System Communication Failure: Central Admin Registry is unreachable."
        )

    # 2. Inspect VPS Response Status
    if vps_response.status_code != 200:
        error_detail = "Incorrect email or password matching registries."
        try:
            error_detail = vps_response.json().get("detail", error_detail)
        except Exception:
            pass
        logger.warning(f"⚠️ PROXY REJECTED [{vps_response.status_code}]: {error_detail}")
        raise HTTPException(status_code=vps_response.status_code, detail=error_detail)

    # 3. Process Authorization Payload & Enforce Role Security
    try:
        vps_data = vps_response.json()
        user_role = vps_data.get("role") or vps_data.get("user_data", {}).get("role")
        
        # Block admin/superadmin profiles on local desktop software
        if user_role in ["admin", "superadmin"]:
            logger.warning(f"🛑 REJECTED: Admin account [{username}] attempted desktop login.")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="ACCESS DENIED: Administrative profiles are restricted from logging into localized Client Software terminals."
            )
            
        if user_role != "client":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access Denied: Terminal environment requires an authorized Client Operator profile."
            )
            
        return {
            "access_token": vps_data.get("access_token"),
            "token_type": "bearer",
            "role": user_role,
            "user_data": vps_data.get("user_data", {
                "id": vps_data.get("user_data", {}).get("id", 101),
                "email": username,
                "role": user_role,
                "name": vps_data.get("user_data", {}).get("name", username.split('@')[0].capitalize()),
                "organization": "MiBOT Ventures",
                "client_id": vps_data.get("user_data", {}).get("client_id", 1)
            })
        }
    except HTTPException:
        raise
    except Exception as parse_err:
        logger.error(f"❌ PAYLOAD PARSE ERROR: Failed to parse VPS JSON response: {parse_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal Server Error: Unexpected response structure from qairosolution.com."
        )


@router.post("/auth/forgot-password")
def forgot_password_recovery(payload: ForgotPasswordPayload):
    vps_endpoint = f"{VPS_ADMIN_API_URL.rstrip('/')}/api/auth/forgot-password"
    try:
        response = requests.post(vps_endpoint, json={"email": payload.email}, headers=DEFAULT_HEADERS, verify=SSL_VERIFY_PATH, timeout=12)
        if response.status_code != 200:
            error_detail = response.json().get("detail", "Failed to process recovery token request.")
            raise HTTPException(status_code=response.status_code, detail=error_detail)
        return {"status": "success", "message": "OTP generation completed and routed successfully."}
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Central Administrative Registry is unreachable: {str(e)}")


@router.post("/auth/verify-otp")
def verify_recovery_otp(payload: VerifyOtpPayload):
    vps_endpoint = f"{VPS_ADMIN_API_URL.rstrip('/')}/api/auth/verify-otp"
    try:
        response = requests.post(vps_endpoint, json={"email": payload.email, "otp": payload.otp}, headers=DEFAULT_HEADERS, verify=SSL_VERIFY_PATH, timeout=12)
        if response.status_code != 200:
            error_detail = response.json().get("detail", "Invalid token structure verification details.")
            raise HTTPException(status_code=response.status_code, detail=error_detail)
        return {"status": "success", "message": "Identity verified successfully."}
    except requests.exceptions.RequestException:
        raise HTTPException(status_code=500, detail="Handshake validation core authentication failure.")


@router.post("/auth/reset-password")
def execute_password_reset(payload: ResetPasswordPayload):
    vps_endpoint = f"{VPS_ADMIN_API_URL.rstrip('/')}/api/auth/reset-password"
    try:
        vps_payload = {"email": payload.email, "otp": payload.otp, "new_password": payload.new_password}
        response = requests.post(vps_endpoint, json=vps_payload, headers=DEFAULT_HEADERS, verify=SSL_VERIFY_PATH, timeout=12)
        if response.status_code != 200:
            error_detail = response.json().get("detail", "Cryptographic password updates rejected.")
            raise HTTPException(status_code=response.status_code, detail=error_detail)
        return {"status": "success", "message": "Account credentials synchronized successfully."}
    except requests.exceptions.RequestException:
        raise HTTPException(status_code=503, detail="Local server connection dropped during synchronization phase.")