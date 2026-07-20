import os
import base64
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db, init_db
from ml_engine import AURAEngine
from sealer import AURAsigner

# Ensure static directories exist
os.makedirs("static/captures", exist_ok=True)

app = FastAPI(
    title="A.U.R.A. - Authenticated Unforgeable Reality Architecture API",
    description="Fuses raw pixel data with live MEMS sensors to verify real-world captures.",
    version="1.0.0"
)

# Enable CORS for local testing and dashboard interaction
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup DB Initialization
@app.on_event("startup")
def on_startup():
    init_db()

# API Key Validation Dependency
def verify_api_key(db: Session = Depends(get_db), x_api_key: Optional[str] = Header(None)):
    if not x_api_key:
        # Audit log for failed key request (anonymous block)
        audit_entry = models.AuditLog(
            event="API_KEY_MISSING",
            meta={"details": "Request blocked due to missing X-API-Key header"}
        )
        db.add(audit_entry)
        db.commit()
        raise HTTPException(status_code=401, detail="X-API-Key header is missing")
    
    # Query organization by API Key hash (stored plain for development seed)
    org = db.query(models.Organization).filter(models.Organization.api_key_hash == x_api_key).first()
    if not org:
        audit_entry = models.AuditLog(
            event="API_KEY_INVALID",
            meta={"invalid_key_attempt": x_api_key[:6] + "..." if len(x_api_key) > 6 else x_api_key}
        )
        db.add(audit_entry)
        db.commit()
        raise HTTPException(status_code=403, detail="Invalid API Key")
    
    return org

# 1. Secure Capture Endpoint
@app.post("/api/capture", response_model=schemas.CaptureResponse)
def capture_image(
    payload: schemas.CaptureRequest,
    db: Session = Depends(get_db),
    org: models.Organization = Depends(verify_api_key)
):
    # Retrieve device by fingerprint
    device = db.query(models.Device).filter(
        models.Device.device_fingerprint == payload.device_fingerprint,
        models.Device.org_id == org.id
    ).first()
    
    if not device:
        # Register new device on-the-fly for developer convenience, or return 400
        device = models.Device(
            org_id=org.id,
            device_fingerprint=payload.device_fingerprint,
            model="Aura Capture Device (Auto-Registered)"
        )
        db.add(device)
        db.commit()
        db.refresh(device)

    sensor_dict = payload.sensor_payload.dict()
    
    # Step A: Run On-Device ML Evaluation simulation on Backend (Reject-before-seal)
    ml_results = AURAEngine.analyze_capture(sensor_dict)
    
    if ml_results["screen_attack"]:
        # Log Audit Trail for Rejected Capture
        audit_entry = models.AuditLog(
            event="CAPTURE_REJECTED",
            meta={
                "device_id": device.id,
                "org_id": org.id,
                "sensor_payload": sensor_dict,
                "rejection_reasons": ml_results["reasons"]
            }
        )
        db.add(audit_entry)
        db.commit()
        
        return schemas.CaptureResponse(
            status="rejected",
            ml_flags={"screen_attack": True, "reasons": ml_results["reasons"]},
            message="Verification Failed: Anti-spoof/screen replay analysis triggered rejection."
        )

    # Step B: Cryptographic Sealing & Watermarking
    try:
        image_hash, watermarked_bytes = AURAsigner.seal_and_watermark(
            image_base64=payload.image_base64,
            sensor_payload=sensor_dict,
            captured_at=payload.captured_at
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image processing failed: {str(e)}")

    # Step C: Save watermarked image to local static storage
    filename = f"{image_hash}.jpg"
    filepath = os.path.join("static", "captures", filename)
    with open(filepath, "wb") as f:
        f.write(watermarked_bytes)

    # Step D: Stub Ledger anchoring (Polygon Tx hash generation)
    # Generates a pseudo-random transaction hash to demonstrate blockchain immutability receipt
    import hashlib
    ledger_tx_hash = f"0x{hashlib.sha256((image_hash + str(datetime.utcnow().timestamp())).encode()).hexdigest()}"

    # Step E: Store in Database
    verification = models.Verification(
        device_id=device.id,
        org_id=org.id,
        image_hash=image_hash,
        sensor_payload=sensor_dict,
        ml_flags={"screen_attack": False, "reasons": []},
        status="verified",
        captured_at=payload.captured_at,
        ledger_tx_hash=ledger_tx_hash
    )
    db.add(verification)
    db.commit()
    db.refresh(verification)

    # Log successful audit event
    audit_entry = models.AuditLog(
        verification_id=verification.id,
        event="CAPTURE_VERIFIED",
        meta={
            "device_id": device.id,
            "org_id": org.id,
            "image_hash": image_hash,
            "ledger_tx": ledger_tx_hash
        }
    )
    db.add(audit_entry)
    db.commit()

    download_url = f"/static/captures/{filename}"

    return schemas.CaptureResponse(
        status="verified",
        image_hash=image_hash,
        verification_id=verification.id,
        ml_flags={"screen_attack": False, "reasons": []},
        ledger_tx_hash=ledger_tx_hash,
        message="Verification Successful: Image verified and cryptographically sealed.",
        download_url=download_url
    )

# 2. Public Verification Endpoint (No Auth Required)
@app.get("/api/verify/{image_hash}", response_model=schemas.VerificationResponse)
def verify_hash(image_hash: str, db: Session = Depends(get_db)):
    verification = db.query(models.Verification).filter(models.Verification.image_hash == image_hash).first()
    if not verification:
        raise HTTPException(status_code=404, detail="Verification record for this hash not found")
    
    # Join queries for descriptive response
    device = db.query(models.Device).filter(models.Device.id == verification.device_id).first()
    org = db.query(models.Organization).filter(models.Organization.id == verification.org_id).first()

    return schemas.VerificationResponse(
        id=verification.id,
        image_hash=verification.image_hash,
        status=verification.status,
        captured_at=verification.captured_at,
        ledger_tx_hash=verification.ledger_tx_hash,
        sensor_payload=verification.sensor_payload,
        ml_flags=verification.ml_flags,
        device_model=device.model if device else "Unknown",
        organization_name=org.name if org else "Unknown",
        created_at=verification.created_at
    )

# 3. Enterprise Verification Feed
@app.get("/api/verifications", response_model=List[schemas.VerificationResponse])
def get_verifications(
    status: Optional[str] = Query(None, description="Filter by status: verified | rejected | flagged"),
    db: Session = Depends(get_db)
):
    query = db.query(models.Verification)
    if status:
        query = query.filter(models.Verification.status == status)
    
    verifications = query.order_by(models.Verification.created_at.desc()).all()
    
    # Fill in relationships manually for response schema mapping
    results = []
    for v in verifications:
        device = db.query(models.Device).filter(models.Device.id == v.device_id).first()
        org = db.query(models.Organization).filter(models.Organization.id == v.org_id).first()
        results.append(
            schemas.VerificationResponse(
                id=v.id,
                image_hash=v.image_hash,
                status=v.status,
                captured_at=v.captured_at,
                ledger_tx_hash=v.ledger_tx_hash,
                sensor_payload=v.sensor_payload,
                ml_flags=v.ml_flags,
                device_model=device.model if device else "Unknown",
                organization_name=org.name if org else "Unknown",
                created_at=v.created_at
            )
        )
    return results

# 4. Security Fraud Analytics Endpoint
@app.get("/api/analytics")
def get_analytics(db: Session = Depends(get_db)):
    # Total captures
    total_verifications = db.query(models.Verification).count()
    
    # Capture statuses
    verified_count = db.query(models.Verification).filter(models.Verification.status == "verified").count()
    
    # Audit log queries to count rejections
    total_rejected = db.query(models.AuditLog).filter(models.AuditLog.event == "CAPTURE_REJECTED").count()
    total_attempts = total_verifications + total_rejected
    
    # Threat vector analysis from rejected logs
    rejections = db.query(models.AuditLog).filter(models.AuditLog.event == "CAPTURE_REJECTED").all()
    pwm_flicker_hits = 0
    moire_pattern_hits = 0
    emf_anomaly_hits = 0
    gravity_violations = 0
    
    for r in rejections:
        meta = r.meta or {}
        reasons = meta.get("rejection_reasons", [])
        for reason in reasons:
            if "PWM" in reason:
                pwm_flicker_hits += 1
            if "Moiré" in reason:
                moire_pattern_hits += 1
            if "EMF" in reason:
                emf_anomaly_hits += 1
            if "gravity" in reason:
                gravity_violations += 1

    # Security alerts over time
    recent_verifications = db.query(models.Verification).order_by(models.Verification.created_at.desc()).limit(10).all()
    
    return {
        "summary": {
            "total_attempts": total_attempts,
            "verified": verified_count,
            "rejected": total_rejected,
            "integrity_score": round((verified_count / total_attempts * 100) if total_attempts > 0 else 100, 1)
        },
        "attack_vectors": {
            "pwm_flicker": pwm_flicker_hits,
            "moire_pattern": moire_pattern_hits,
            "emf_anomaly": emf_anomaly_hits,
            "gravity_violations": gravity_violations
        },
        "recent_activity": [
            {
                "id": v.id,
                "hash": v.image_hash,
                "captured_at": v.captured_at,
                "status": v.status,
                "device": db.query(models.Device).filter(models.Device.id == v.device_id).first().model
            } for v in recent_verifications
        ]
    }

# Mount Static Dashboard Files
app.mount("/", StaticFiles(directory="static", html=True), name="static")
