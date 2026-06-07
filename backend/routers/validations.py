from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import os
import uuid
import json
import re
import pytz

from backend import auth_utils, models
from backend.database import get_db
from backend.api_utils import success_response, error_response
from backend.config import settings
from backend.ocr_utils import extract_product_data

router = APIRouter(prefix="/api/validations")

IST = pytz.timezone("Asia/Kolkata")

DATE_FORMATS = [
    "%d/%m/%Y",
    "%d.%m.%Y",
    "%d-%m-%Y",
    "%Y/%m/%d",
    "%Y.%m.%d",
    "%Y-%m-%d",
]

def normalize_date(date_str):
    if not date_str:
        return None

    date_str = str(date_str).strip()

    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


@router.post("/analyze")
async def analyze_product(
    wid: Optional[str] = Form(None),
    ocr_method: str = Form("local_ocr"),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    payload: dict = Depends(
        auth_utils.RoleChecker(["admin", "operator"])
    )
):

    # ==========================
    # Input Validation
    # ==========================
    if not wid and not (image and image.filename):
        return error_response(
            "You must provide either a WID or an Image.",
            status_code=400
        )

    product = None
    filename = None
    filepath = None
    notes = ""

    extracted_data = {
        "wid": None,
        "ean": None,
        "mfg_date": None,
        "exp_date": None
    }

    # ==========================
    # WID Lookup (Manual)
    # ==========================
    if wid:
        product = (
            db.query(models.Product)
            .filter(models.Product.wid == wid)
            .first()
        )

    # ==========================
    # OCR Processing
    # ==========================
    if image and image.filename:

        os.makedirs("uploads", exist_ok=True)

        ext = image.filename.split(".")[-1]
        filename = f"{uuid.uuid4()}.{ext}"

        filepath = os.path.join(
            "uploads",
            filename
        )

        with open(filepath, "wb") as f:
            f.write(await image.read())

        try:
            result, notes = extract_product_data(
                ocr_method=ocr_method,
                image_path=filepath,
                api_key=settings.gemini_api_key
            )   

            if result:
                #print("OCR Result:", result)
                extracted_data.update(result)

                # Auto use OCR WID
                if not wid and extracted_data.get("wid"):
                    wid = str(
                        extracted_data["wid"]
                    ).strip()
                    #print(f"Using OCR-extracted WID: {wid}")

        except Exception as e:
            notes = f"OCR Error: {str(e)}"

    # ==========================
    # Product Lookup Using OCR WID
    # ==========================
    if wid:
        product = (
            db.query(models.Product)
            .filter(models.Product.wid == wid)
            .first()
        )
        #print(f"Product lookup for WID '{wid}': {'Found' if product else 'Not Found'}")
    # ==========================
    # Validation Logic
    # ==========================
    status = "Mismatch"

    if not product:

        if wid:
            status = "Not Found"
        else:
            status = "Manual Check Required"

    elif not image or not image.filename:

        status = "Match"
        notes = "Verified by WID only."

    else:

        matches = []

        # WID Match
        if extracted_data.get("wid"):
            matches.append(
                str(extracted_data["wid"]).strip()
                ==
                str(product.wid).strip()
            )

        # EAN Match
        if extracted_data.get("ean") and product.ean:
            matches.append(
                str(extracted_data["ean"]).strip()
                ==
                str(product.ean).strip()
            )

        # MFG Match
        if extracted_data.get("mfg_date") and product.mfg_date:

            matches.append(
                normalize_date(
                    extracted_data["mfg_date"]
                )
                ==
                normalize_date(
                    product.mfg_date
                )
            )

        # EXP Match
        if extracted_data.get("exp_date") and product.exp_date:

            matches.append(
                normalize_date(
                    extracted_data["exp_date"]
                )
                ==
                normalize_date(
                    product.exp_date
                )
            )

        if len(matches) == 0:

            status = "Manual Check Required"

        elif all(matches):

            status = "Match"

        elif any(matches):

            status = "Partial Match"

        else:

            status = "Mismatch"

    # ==========================
    # Save Validation
    # ==========================
    operator_username = payload.get(
        "sub",
        "Unknown Operator"
    )

    validation = models.Validation(
        wid=wid,
        operator_id=operator_username,
        timestamp=datetime.now(IST),
        image_path=f"/uploads/{filename}"
        if filename else None,
        status=status,
        ocr_method=ocr_method
        if image and image.filename else None,
        extracted_data=json.dumps(extracted_data),
        gemini_notes=notes
    )

    db.add(validation)
    db.commit()

    # ==========================
    # Response
    # ==========================
    return success_response(
        message="Analysis complete.",
        data={
            "status": status,
            "wid": wid,
            "ocr_method": (
                ocr_method
                if image and image.filename
                else None
            ),
            "image_path": (
                f"/uploads/{filename}"
                if filename else None
            ),
            "notes": notes,
            "extracted_data": extracted_data,
            "db_product": {
                "wid": product.wid,
                "ean": product.ean,
                "mfg_date": product.mfg_date,
                "exp_date": product.exp_date
            } if product else None
        }
    )