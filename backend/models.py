from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import relationship
from database import Base

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    sector = Column(String(100), nullable=False)
    api_key_hash = Column(String(255), unique=True, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    devices = relationship("Device", back_populates="organization")
    verifications = relationship("Verification", back_populates="organization")

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    device_fingerprint = Column(String(255), unique=True, index=True, nullable=False)
    model = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization", back_populates="devices")
    verifications = relationship("Verification", back_populates="devices")

class Verification(Base):
    __tablename__ = "verifications"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    image_hash = Column(String(64), unique=True, index=True, nullable=False) # SHA-256 is 64 hex characters
    sensor_payload = Column(JSON, nullable=False) # Store lux, magnetometer_uT, gravity_xyz, pwm_score, moire_score
    ml_flags = Column(JSON, nullable=False) # Store screen_attack, reasons
    status = Column(String(50), nullable=False) # verified | rejected | flagged
    captured_at = Column(DateTime(timezone=True), nullable=False)
    ledger_tx_hash = Column(String(66), nullable=True) # Transaction hash (0x + 64 hex chars)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization", back_populates="verifications")
    devices = relationship("Device", back_populates="verifications")
    audit_logs = relationship("AuditLog", back_populates="verification")

class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    verification_id = Column(Integer, ForeignKey("verifications.id"), nullable=True) # Can be null if rejected before creation of verification row
    event = Column(String(100), nullable=False) # e.g. CAPTURE_VERIFIED, CAPTURE_REJECTED, API_KEY_VERIFIED
    meta = Column(JSON, nullable=False) # Extra context/debug details
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    verification = relationship("Verification", back_populates="audit_logs")
