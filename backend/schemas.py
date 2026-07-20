from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class SensorPayload(BaseModel):
    lux: float = Field(..., description="Ambient light level in lux")
    magnetometer_uT: float = Field(..., description="Total magnetic field strength in microtesla (µT) or raw x,y,z")
    magnetometer_details: Optional[Dict[str, float]] = Field(None, description="Optional raw x, y, z magnetic components")
    gravity_xyz: List[float] = Field(..., min_items=3, max_items=3, description="3-axis gravity vector coordinates [x, y, z]")
    pwm_score: Optional[float] = Field(0.0, description="PWM flicker score (0.0 to 1.0)")
    moire_score: Optional[float] = Field(0.0, description="Moiré grid pattern score (0.0 to 1.0)")

class CaptureRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded string of the captured image")
    device_fingerprint: str = Field(..., description="Hardware-fused device fingerprint identifier")
    sensor_payload: SensorPayload = Field(..., description="Fused environmental sensor readings at capture time")
    captured_at: datetime = Field(..., description="Timestamp of shutter execution on device")

class VerificationResponse(BaseModel):
    id: int
    image_hash: str
    status: str
    captured_at: datetime
    ledger_tx_hash: Optional[str] = None
    sensor_payload: Dict[str, Any]
    ml_flags: Dict[str, Any]
    device_model: str
    organization_name: str
    created_at: datetime

    class Config:
        from_attributes = True

class CaptureResponse(BaseModel):
    status: str  # verified | rejected
    image_hash: Optional[str] = None
    verification_id: Optional[int] = None
    ml_flags: Dict[str, Any]
    ledger_tx_hash: Optional[str] = None
    message: str
    download_url: Optional[str] = None
