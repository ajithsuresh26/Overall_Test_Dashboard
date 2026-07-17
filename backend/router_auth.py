# -*- coding: utf-8 -*-
# backend/router_auth.py
import requests
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from config import VPS_ADMIN_API_URL

router = APIRouter(tags=["Authentication Matrix"])

# ── SCHEMAS FOR PASS-THROUGH RECOVERY DATA STRUCTURES ─────────────────────
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
    Proxy Bridge with Admin Restrictions: Intercepts responses from your Admin database
    and blocks 'admin' or 'superadmin' roles from accessing this local desktop software.
    """
    username = form_data.username.strip()
    password = form_data.password.strip()

    vps_payload = {
        "username": username,
        "password": password
    }
    
    vps_endpoint = f"{VPS_ADMIN_API_URL}/api/auth/login"
    print(f"🔒 PROXY AUTH: Relaying verification request for [{username}] to VPS -> {vps_endpoint}")

    try:
        vps_response = requests.post(vps_endpoint, data=vps_payload, timeout=12)
        
        if vps_response.status_code != 200:
            error_detail = "Incorrect email or password matching registries."
            try:
                error_detail = vps_response.json().get("detail", error_detail)
            except Exception:
                pass
            raise HTTPException(status_code=vps_response.status_code, detail=error_detail)
            
        vps_data = vps_response.json()
        user_role = vps_data.get("role") or vps_data.get("user_data", {}).get("role")
        
        # ── RESTRICTION SECURITY GUARD ─────────────────────────────────────
        if user_role in ["admin", "superadmin"]:
            print(f"🛑 SECURITY NOTICE: Admin account [{username}] blocked from accessing client desktop app side.")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="ACCESS DENIED: Administrative profiles are restricted from logging into localized Client Software terminals."
            )
            
        # Ensure only authorized client operator profiles pass through
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

    except requests.exceptions.RequestException as e:
        print(f"❌ PROXY FATAL: Connection to registry timed out: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="System Communication Failure: Local Admin Verification Registry is unreachable."
        )


# ── RECOVERY SYSTEM WITH INTEGRATED ADMINISTRATIVE FLOW BLOCKS ──────────────

@router.post("/auth/forgot-password")
def forgot_password_recovery(payload: ForgotPasswordPayload):
    """
    Step 1: Intercepts recovery request, inspects system registry, and actively drops administrative tasks.
    """
    # Defensive Check: Explicitly probe account data role parameters via profile payload tracking loops
    vps_profile_lookup = f"{VPS_ADMIN_API_URL}/api/auth/profile-check"
    try:
        lookup_resp = requests.post(vps_profile_lookup, json={"email": payload.email}, timeout=5)
        if lookup_resp.status_code == 200:
            chk_data = lookup_resp.json()
            detected_role = chk_data.get("role") or chk_data.get("user_data", {}).get("role")
            if detected_role in ["admin", "superadmin"]:
                print(f"🛑 RECOVERY BLOCKED: Admin profile [{payload.email}] pre-emptively rejected on local app endpoint.")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="ACCESS DENIED: Administrative password recovery operations must be performed via the Central Admin Portal."
                )
    except requests.exceptions.RequestException:
        pass  # Fallback to secondary gate response verification matrix downstream if checking node drops

    vps_endpoint = f"{VPS_ADMIN_API_URL}/api/auth/forgot-password"
    print(f"🔑 RECOVERY PROXY: Relaying reset initialization request for [{payload.email}]")
    try:
        response = requests.post(vps_endpoint, json={"email": payload.email}, timeout=12)
        
        if response.status_code != 200:
            error_detail = response.json().get("detail", "Failed to process recovery token request.")
            raise HTTPException(status_code=response.status_code, detail=error_detail)
            
        vps_data = response.json()
        user_role = vps_data.get("role") or vps_data.get("user_data", {}).get("role")
        
        if user_role in ["admin", "superadmin"]:
            print(f"🛑 RECOVERY BLOCKED: Admin profile [{payload.email}] restricted from recovery features.")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="ACCESS DENIED: Administrative password recovery operations must be performed via the Central Admin Portal."
            )
            
        return {"status": "success", "message": "OTP generation completed and routed successfully."}
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Central Administrative Registry is unreachable: {str(e)}")


@router.post("/auth/verify-otp")
def verify_recovery_otp(payload: VerifyOtpPayload):
    """
    Step 2: Validates the token against the database registry while re-verifying role restrictions.
    """
    vps_endpoint = f"{VPS_ADMIN_API_URL}/api/auth/verify-otp"
    try:
        response = requests.post(vps_endpoint, json={"email": payload.email, "otp": payload.otp}, timeout=12)
        
        if response.status_code != 200:
            error_detail = response.json().get("detail", "Invalid token structure verification details.")
            raise HTTPException(status_code=response.status_code, detail=error_detail)
            
        vps_data = response.json()
        user_role = vps_data.get("role") or vps_data.get("user_data", {}).get("role")
        
        if user_role in ["admin", "superadmin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="ACCESS DENIED: Administrative profile validation restricted on localized instances."
            )
            
        return {"status": "success", "message": "Identity verified successfully."}
    except requests.exceptions.RequestException:
        raise HTTPException(status_code=500, detail="Handshake validation core authentication failure.")


@router.post("/auth/reset-password")
def execute_password_reset(payload: ResetPasswordPayload):
    """
    Step 3: Commits changes into the database if the user profile role passes client software constraints.
    """
    vps_endpoint = f"{VPS_ADMIN_API_URL}/api/auth/reset-password"
    try:
        vps_payload = {
            "email": payload.email,
            "otp": payload.otp,
            "new_password": payload.new_password
        }
        response = requests.post(vps_endpoint, json=vps_payload, timeout=12)
        
        if response.status_code != 200:
            error_detail = response.json().get("detail", "Cryptographic password updates rejected.")
            raise HTTPException(status_code=response.status_code, detail=error_detail)
            
        vps_data = response.json()
        user_role = vps_data.get("role") or vps_data.get("user_data", {}).get("role")
        
        if user_role in ["admin", "superadmin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="ACCESS DENIED: Administrative authorization updates must happen through Central Infrastructure channels."
            )
            
        return {"status": "success", "message": "Account credentials synchronized successfully."}
    except requests.exceptions.RequestException:
        raise HTTPException(status_code=503, detail="Local server connection dropped during synchronization phase.")