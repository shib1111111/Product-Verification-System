import json
import logging
import re
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# ============================================================
# Global Initialization
# ============================================================

OCR_ENGINE = None
BARCODE_DETECTOR = None

try:
    import cv2
    from rapidocr_onnxruntime import RapidOCR

    OCR_ENGINE = RapidOCR()

    try:
        if hasattr(cv2, "barcode"):
            BARCODE_DETECTOR = cv2.barcode.BarcodeDetector()
            logger.info("BarcodeDetector initialized")
        else:
            logger.warning("cv2.barcode not available")
    except Exception as e:
        logger.warning(f"BarcodeDetector init failed: {e}")

    logger.info("RapidOCR initialized successfully")

except Exception as e:
    logger.exception(f"OCR initialization failed: {e}")


# ============================================================
# Regex Patterns
# ============================================================

PATTERNS = {
    "wid": re.compile(
        r"(?i)\bwid\b\s*[:\-]?\s*([A-Z0-9\-]+)"
    ),
    "ean": re.compile(
        r"(?i)\bean\b\s*[:\-]?\s*([0-9]{8,14})"
    ),
    "mfg_date": re.compile(
        r"(?i)(?:mfg|mfd|manufactured|manufacturing)"
        r"\s*[:\-]?\s*"
        r"([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4})"
    ),
    "exp_date": re.compile(
        r"(?i)(?:exp|expiry|expires|best\s*before)"
        r"\s*[:\-]?\s*"
        r"([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4})"
    ),
    "lot": re.compile(
        r"(?i)(?:lot|lot\s*no|batch)"
        r"\s*[:\-]?\s*([A-Z0-9\-]+)"
    ),
}


# ============================================================
# Barcode Extraction
# ============================================================

def extract_barcode(image_path: str) -> Optional[str]:
    """
    Extract barcode using OpenCV BarcodeDetector.
    Compatible with multiple OpenCV versions.
    """

    try:
        if BARCODE_DETECTOR is None:
            return None

        import cv2

        image = cv2.imread(image_path)

        if image is None:
            return None

        result = BARCODE_DETECTOR.detectAndDecode(image)

        if not result:
            return None

        logger.debug(f"Barcode result: {result}")

        if len(result) == 4:
            success, decoded_info, _, _ = result

        elif len(result) == 3:
            decoded_info, _, _ = result
            success = bool(decoded_info)

        else:
            return None

        if not success:
            return None

        if isinstance(decoded_info, (list, tuple)):
            for code in decoded_info:
                if code:
                    return str(code).strip()

        if isinstance(decoded_info, str):
            return decoded_info.strip()

        return None

    except Exception as e:
        logger.warning(f"Barcode extraction failed: {e}")
        return None


# ============================================================
# Text Parsing
# ============================================================

def parse_product_fields(raw_text: str) -> Dict[str, Any]:
    """
    Extract fields from OCR text.
    """

    data = {
        "wid": None,
        "ean": None,
        "mfg_date": None,
        "exp_date": None,
        "lot": None,
    }

    for field, pattern in PATTERNS.items():
        match = pattern.search(raw_text)

        if match:
            data[field] = match.group(1).strip()

    return data


# ============================================================
# RapidOCR Extraction
# ============================================================

def extract_with_rapidocr(image_path: str):
    """
    OCR extraction using RapidOCR.
    """

    try:
        if OCR_ENGINE is None:
            raise RuntimeError("RapidOCR not initialized")

        extracted = {
            "wid": None,
            "ean": None,
            "mfg_date": None,
            "exp_date": None,
            "lot": None,
            "raw_text": "",
        }

        # Barcode first
        extracted["ean"] = extract_barcode(image_path)

        result, _ = OCR_ENGINE(image_path)

        if not result:
            return None, "No text detected"

        text_lines = []

        for item in result:
            try:
                text_lines.append(item[1])
            except Exception:
                continue

        raw_text = "\n".join(text_lines)

        extracted["raw_text"] = raw_text

        logger.info(f"OCR Text:\n{raw_text}")

        parsed = parse_product_fields(raw_text)

        for key, value in parsed.items():
            if value:
                extracted[key] = value

        return extracted, "RapidOCR extraction successful"

    except Exception as e:
        logger.exception("RapidOCR extraction failed")
        return None, f"RapidOCR Error: {str(e)}"


# ============================================================
# Gemini Fallback
# ============================================================

def extract_with_gemini(
    image_path: str,
    api_key: str
):
    """
    Gemini Vision fallback.
    """

    if not api_key:
        return None, "Gemini API key missing"

    try:
        from google import genai
        from PIL import Image

        client = genai.Client(api_key=api_key)

        image = Image.open(image_path)

        prompt = """
Extract product information.

Return ONLY valid JSON.

{
  "wid": null,
  "ean": null,
  "mfg_date": null,
  "exp_date": null,
  "lot": null
}
"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt, image]
        )

        text = (
            response.text
            .replace("```json", "")
            .replace("```", "")
            .strip()
        )

        data = json.loads(text)

        return data, "Gemini extraction successful"

    except Exception as e:
        logger.exception("Gemini extraction failed")
        return None, f"Gemini Error: {str(e)}"


# ============================================================
# Main Pipeline
# ============================================================

def extract_product_data(
    image_path: str,
    api_key: str
):
    """
    Production extraction pipeline.

    1. Barcode
    2. RapidOCR
    3. Gemini fallback
    """

    result, notes = extract_with_rapidocr(image_path)

    if result:

        useful_fields = [
            result.get("wid"),
            result.get("ean"),
            result.get("mfg_date"),
            result.get("exp_date"),
            result.get("lot"),
        ]

        if any(useful_fields):
            return result, notes

    logger.warning(
        "RapidOCR insufficient. Using Gemini fallback."
    )

    return extract_with_gemini(
        image_path=image_path,
        api_key=api_key
    )