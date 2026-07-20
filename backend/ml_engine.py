from typing import Dict, Any, List

class AURAEngine:
    @staticmethod
    def analyze_capture(sensor_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyzes pixel features and environmental sensor data to detect screen-replay attacks.
        Returns:
            dict containing:
                - screen_attack: bool (True if fraud detected)
                - reasons: list of strings detailing why it was flagged
                - moire_score: float (0.0 to 1.0)
                - pwm_score: float (0.0 to 1.0)
                - emf_anomaly: bool
        """
        reasons = []
        screen_attack = False
        
        # 1. Magnetometer check (EMF Anomalies)
        # Earth's ambient magnetic field is typically between 25 and 65 uT (microteslas).
        # Proximity to screens/monitors (with strong magnetic backlights or coils) spikes this value.
        mag_strength = sensor_data.get("magnetometer_uT", 0.0)
        emf_anomaly = False
        if mag_strength > 120.0:
            emf_anomaly = True
            reasons.append(f"Abnormal EMF interference detected: {mag_strength:.2f} µT (typical screen range, ambient is 25-65 µT)")
            screen_attack = True
        elif mag_strength < 5.0:
            # Shielding or spoof sensor detected
            emf_anomaly = True
            reasons.append(f"Suspiciously low EMF reading: {mag_strength:.2f} µT (sensor spoofing suspected)")
            screen_attack = True

        # 2. Photometer check (PWM Flicker Detection)
        # Screens utilize Pulse-Width Modulation (PWM) to dim backlights, which introduces flicker.
        # Live natural environments illuminated by sunlight/stable DC lighting do not show high PWM scores.
        pwm_score = sensor_data.get("pwm_score", 0.0)
        if pwm_score > 0.5:
            reasons.append(f"Invisible high-frequency PWM backlight flicker detected (Score: {pwm_score:.2f})")
            screen_attack = True

        # 3. Visual checks (Moiré grid pattern analysis)
        # Taking a photo of a pixel display causes interference grids known as Moiré patterns.
        moire_score = sensor_data.get("moire_score", 0.0)
        if moire_score > 0.4:
            reasons.append(f"Visual Moiré pixel-grid pattern detected (Score: {moire_score:.2f})")
            screen_attack = True

        # 4. Sensor Fusion Constraints (Gravity Vector vs Image Orientation)
        # A flat screen being photographed often has a gravity vector inconsistent with live 3D capture.
        # For instance, zero change in gravity while capture angle changes suggests a synthetic posture.
        gravity = sensor_data.get("gravity_xyz", [0.0, 0.0, 9.8])
        # Calculate net acceleration
        g_magnitude = sum(x**2 for x in gravity) ** 0.5
        if not (8.0 < g_magnitude < 12.0):
            reasons.append(f"Invalid gravity vector magnitude: {g_magnitude:.2f} m/s² (physics violation - fake sensor data)")
            screen_attack = True

        return {
            "screen_attack": screen_attack,
            "reasons": reasons,
            "moire_score": moire_score,
            "pwm_score": pwm_score,
            "emf_anomaly": emf_anomaly
        }
