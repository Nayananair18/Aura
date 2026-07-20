import io
import base64
import hashlib
import json
from datetime import datetime
from PIL import Image, ImageOps
import qrcode
from PIL.ExifTags import TAGS

class AURAsigner:
    @staticmethod
    def seal_and_watermark(image_base64: str, sensor_payload: dict, captured_at: datetime) -> tuple:
        """
        Cryptographic Sealing Pipeline:
        1. Decode base64 image data.
        2. Concatenate binary image content + sorted sensor payload JSON string.
        3. Compute the SHA-256 hash (the unforgeable reality fingerprint).
        4. Generate a QR code containing the verification URL and overlay it on the image.
        5. Write the SHA-256 hash into the image's EXIF metadata.
        6. Return (image_hash, watermarked_image_bytes)
        """
        # 1. Decode image base64
        try:
            image_data = base64.b64decode(image_base64.split(",")[-1])
        except Exception as e:
            raise ValueError(f"Invalid base64 image data: {e}")

        # 2. Serialize sensor data stably
        sensor_json_str = json.dumps(sensor_payload, sort_keys=True)
        
        # 3. Concatenate and compute hash
        hasher = hashlib.sha256()
        hasher.update(image_data)
        hasher.update(sensor_json_str.encode("utf-8"))
        hasher.update(captured_at.isoformat().encode("utf-8"))
        image_hash = hasher.hexdigest()

        # Load image into PIL for watermarking
        img = Image.open(io.BytesIO(image_data))
        # Ensure correct image mode (e.g. RGB)
        if img.mode != "RGB":
            img = img.convert("RGB")
        
        # 4. Generate QR code
        verify_url = f"http://localhost:8000/verify/{image_hash}"
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=4,
            border=2,
        )
        qr.add_data(verify_url)
        qr.make(fit=True)
        # Create a beautiful QR code using A.U.R.A. colors (deep navy background, glowing cyan QR code)
        qr_img = qr.make_image(fill_color="#22D3EE", back_color="#0A0E17").convert("RGB")
        
        # Overlay QR code on the bottom-right corner of the image
        # Scale QR code proportional to the main image (e.g., 15% of width)
        scale_pct = 0.15
        qr_width = int(img.width * scale_pct)
        if qr_width < 100:
            qr_width = 100
        if qr_width > img.width or qr_width > img.height:
            qr_width = min(img.width, img.height) // 2
            
        qr_img = qr_img.resize((qr_width, qr_width), Image.Resampling.LANCZOS)
        
        # Add a subtle cyan/violet border to the QR code
        border_size = 2
        qr_bordered = ImageOps.expand(qr_img, border=border_size, fill="#7C3AED")
        
        # Position at bottom-right corner with padding
        padding = 15
        pos_x = img.width - qr_bordered.width - padding
        pos_y = img.height - qr_bordered.height - padding
        
        # Composite image
        img_watermarked = img.copy()
        img_watermarked.paste(qr_bordered, (pos_x, pos_y))

        # 5. Inject EXIF metadata
        # We can write the cryptographic seal hash to EXIF UserComment (0x9286)
        exif = img_watermarked.getexif()
        # EXIF Tag for UserComment is 37515 (0x9286)
        exif[37515] = f"AURA_SEAL_HASH:{image_hash}".encode("utf-8")
        
        # Save output image to a bytes buffer with modified EXIF data
        output_buffer = io.BytesIO()
        img_watermarked.save(output_buffer, format="JPEG", exif=exif, quality=90)
        watermarked_bytes = output_buffer.getvalue()

        return image_hash, watermarked_bytes
