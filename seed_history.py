import os
import random
import hashlib
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Import backend modules
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

import models
from database import DATABASE_URL, init_db

def seed_rich_history():
    print("Seeding rich sample history into database for dashboard visualization...")
    
    # Initialize DB schema if not done
    init_db()
    
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    # 1. Get or create Organization and Device
    org = db.query(models.Organization).first()
    if not org:
        org = models.Organization(
            name="Aura Dev Org",
            sector="Technology & Security",
            api_key_hash="aura_dev_secret_key_2026"
        )
        db.add(org)
        db.commit()
        db.refresh(org)

    device = db.query(models.Device).first()
    if not device:
        device = models.Device(
            org_id=org.id,
            device_fingerprint="aura_dev_sim_fingerprint_9921",
            model="Aura Capture Simulator v1.0"
        )
        db.add(device)
        db.commit()
        db.refresh(device)
        
    # Clear existing verifications and audit logs to have a clean rich graph
    db.query(models.AuditLog).delete()
    db.query(models.Verification).delete()
    db.commit()

    # Presets for generating synthetic samples
    threat_profiles = [
        {
            "name": "Natural Outdoor Capture",
            "lux": (500.0, 1500.0),
            "emf": (30.0, 55.0),
            "pwm": (0.0, 0.05),
            "moire": (0.0, 0.04),
            "grav": (9.75, 9.85),
            "status": "verified",
            "reasons": []
        },
        {
            "name": "Natural Indoor Capture",
            "lux": (150.0, 400.0),
            "emf": (35.0, 60.0),
            "pwm": (0.01, 0.09),
            "moire": (0.0, 0.05),
            "grav": (9.75, 9.85),
            "status": "verified",
            "reasons": []
        },
        {
            "name": "Screen Replay Attack (Monitor)",
            "lux": (180.0, 250.0),
            "emf": (130.0, 210.0), # EMF anomaly
            "pwm": (0.08, 0.18),
            "moire": (0.50, 0.85), # Moiré pattern
            "grav": (9.8, 9.8),
            "status": "rejected",
            "reasons": ["Visual Moiré pixel-grid pattern detected", "Abnormal EMF interference detected (monitor proximity)"]
        },
        {
            "name": "Screen Replay Attack (PWM Flicker)",
            "lux": (80.0, 150.0),
            "emf": (40.0, 70.0),
            "pwm": (0.65, 0.88), # PWM flicker
            "moire": (0.1, 0.3),
            "grav": (9.8, 9.8),
            "status": "rejected",
            "reasons": ["Invisible high-frequency PWM backlight flicker detected"]
        },
        {
            "name": "Physics Violation (Gravity Spoof)",
            "lux": (200.0, 500.0),
            "emf": (30.0, 50.0),
            "pwm": (0.0, 0.05),
            "moire": (0.0, 0.05),
            "grav": (-2.0, 2.0), # Gravity vector doesn't make sense (magnitude is off)
            "status": "rejected",
            "reasons": ["Invalid gravity vector magnitude (physics violation - fake sensor data)"]
        }
    ]

    base_time = datetime.utcnow() - timedelta(days=7)
    
    # Generate 45 events distributed over the last week
    for i in range(45):
        profile = random.choices(
            threat_profiles, 
            weights=[40, 30, 15, 10, 5], # 70% verified, 30% spoof attempts
            k=1
        )[0]
        
        event_time = base_time + timedelta(
            hours=random.randint(1, 160), 
            minutes=random.randint(1, 59)
        )
        
        lux_val = round(random.uniform(*profile["lux"]), 2)
        emf_val = round(random.uniform(*profile["emf"]), 2)
        pwm_val = round(random.uniform(*profile["pwm"]), 2)
        moire_val = round(random.uniform(*profile["moire"]), 2)
        grav_val = round(random.uniform(*profile["grav"]), 2)
        
        sensor_payload = {
            "lux": lux_val,
            "magnetometer_uT": emf_val,
            "gravity_xyz": [0.0, 0.0, grav_val],
            "pwm_score": pwm_val,
            "moire_score": moire_val
        }

        # Simulate base64 image data hashing
        seed_str = f"{i}-{event_time.isoformat()}-{lux_val}"
        image_hash = hashlib.sha256(seed_str.encode('utf-8')).hexdigest()
        
        if profile["status"] == "verified":
            ledger_tx_hash = f"0x{hashlib.sha256((image_hash + 'ledger').encode()).hexdigest()}"
            
            # Save verification row
            verification = models.Verification(
                device_id=device.id,
                org_id=org.id,
                image_hash=image_hash,
                sensor_payload=sensor_payload,
                ml_flags={"screen_attack": False, "reasons": []},
                status="verified",
                captured_at=event_time,
                ledger_tx_hash=ledger_tx_hash,
                created_at=event_time
            )
            db.add(verification)
            db.commit()
            db.refresh(verification)
            
            # Save audit log
            audit_entry = models.AuditLog(
                verification_id=verification.id,
                event="CAPTURE_VERIFIED",
                meta={
                    "device_id": device.id,
                    "org_id": org.id,
                    "image_hash": image_hash,
                    "ledger_tx": ledger_tx_hash
                },
                created_at=event_time
            )
            db.add(audit_entry)
            db.commit()
            
            # Draw a simple placeholder image for verify endpoint so download/verify displays nicely
            filename = f"{image_hash}.jpg"
            filepath = os.path.join("backend", "static", "captures", filename)
            if not os.path.exists(filepath):
                with open(filepath, "wb") as f:
                    f.write(b"MOCK_IMAGE_BYTES_AURA_SEAL_HASH:" + image_hash.encode())

        else:
            # Rejections don't write verification record, they only write Audit log entries
            audit_entry = models.AuditLog(
                event="CAPTURE_REJECTED",
                meta={
                    "device_id": device.id,
                    "org_id": org.id,
                    "sensor_payload": sensor_payload,
                    "rejection_reasons": profile["reasons"]
                },
                created_at=event_time
            )
            db.add(audit_entry)
            db.commit()

    print("Success! Seeded 45 verification and threat audit logs into SQLite.")
    db.close()

if __name__ == "__main__":
    seed_rich_history()
