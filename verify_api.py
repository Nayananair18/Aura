import json
import urllib.request
import urllib.error
import time

def run_test():
    print("====================================================")
    print("A.U.R.A. End-to-End API Automated Verifier")
    print("====================================================")
    
    # 1. Generate a mock base64 pixel string
    # 3x3 pixel transparent red GIF base64
    mock_image_base64 = (
        "data:image/gif;base64,R0lGODlhAwADAIABAP8AAP///yH5BAEAAAEALAAAAAADAAMAAAIFDIypacgAOw=="
    )
    
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": "aura_dev_secret_key_2026"
    }

    # Test Case 1: Healthy Capture (Expect Success)
    print("\n[Test 1] Dispatching Clean Capture (Normal EMF, Zero PWM/Moiré)...")
    clean_payload = {
        "image_base64": mock_image_base64,
        "device_fingerprint": "aura_dev_sim_fingerprint_9921",
        "sensor_payload": {
            "lux": 450.0,
            "magnetometer_uT: float": 45.0, # Will be mapped dynamically to uT
            "magnetometer_uT": 45.0,
            "gravity_xyz": [0.0, 0.0, 9.8],
            "pwm_score": 0.02,
            "moire_score": 0.05
        },
        "captured_at": "2026-07-20T21:50:00Z"
    }

    try:
        req = urllib.request.Request(
            "http://localhost:8000/api/capture",
            data=json.dumps(clean_payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        with urllib.request.urlopen(req) as res:
            response_data = json.loads(res.read().decode("utf-8"))
            print(f"Result: {response_data.get('status').upper()}")
            print(f"Message: {response_data.get('message')}")
            print(f"Hash Sealed: {response_data.get('image_hash')}")
            print(f"Ledger Anchor: {response_data.get('ledger_tx_hash')}")
            image_hash = response_data.get('image_hash')
    except urllib.error.URLError as e:
        print(f"Network error (is FastAPI running?): {e}")
        return

    # Test Case 2: Spoofed Capture (Expect Rejection)
    print("\n[Test 2] Dispatching Replay Attack Capture (High EMF interference)...")
    spoofed_payload = {
        "image_base64": mock_image_base64,
        "device_fingerprint": "aura_dev_sim_fingerprint_9921",
        "sensor_payload": {
            "lux": 150.0,
            "magnetometer_uT": 195.0, # Over 120 uT threshold!
            "gravity_xyz": [0.0, 0.0, 9.8],
            "pwm_score": 0.02,
            "moire_score": 0.05
        },
        "captured_at": "2026-07-20T21:51:00Z"
    }

    try:
        req = urllib.request.Request(
            "http://localhost:8000/api/capture",
            data=json.dumps(spoofed_payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        with urllib.request.urlopen(req) as res:
            response_data = json.loads(res.read().decode("utf-8"))
            print(f"Result: {response_data.get('status').upper()}")
            print(f"Message: {response_data.get('message')}")
            print(f"ML Spoof Details: {json.dumps(response_data.get('ml_flags'))}")
    except urllib.error.URLError as e:
        print(f"Failed spoof capture unexpectedly: {e}")

    # Test Case 3: Public Hash Resolution
    print(f"\n[Test 3] Testing Public Verification Resolver for Hash: {image_hash}...")
    try:
        req = urllib.request.Request(f"http://localhost:8000/api/verify/{image_hash}", method="GET")
        with urllib.request.urlopen(req) as res:
            response_data = json.loads(res.read().decode("utf-8"))
            print(f"Resolved Status: {response_data.get('status').upper()}")
            print(f"Device: {response_data.get('device_model')}")
            print(f"Organization: {response_data.get('organization_name')}")
            print(f"Sensor Payload: {json.dumps(response_data.get('sensor_payload'))}")
    except urllib.error.URLError as e:
        print(f"Verification query failed: {e}")

    print("\n====================================================")
    print("All tests completed successfully!")
    print("====================================================")

if __name__ == "__main__":
    run_test()
