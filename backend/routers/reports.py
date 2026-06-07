from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import List
import io, csv, tempfile

from backend import auth_utils, models, schemas
from backend.database import get_db
from backend.api_utils import success_response, error_response
import pytz

IST = pytz.timezone("Asia/Kolkata")

router = APIRouter(prefix="/api/reports")

@router.get("/", response_model=dict)
def get_reports(
    start_date: str = Query(..., description="Start date in YYYY-MM-DD format"),
    end_date: str = Query(..., description="End date in YYYY-MM-DD format"),
    db: Session = Depends(get_db),
    payload: dict = Depends(auth_utils.RoleChecker(["admin", "qa"]))
):
    try:
        sd = IST.localize(datetime.strptime(start_date, "%Y-%m-%d"))
        ed = IST.localize(datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59))
    except ValueError:
            return error_response("Invalid date format.", status_code=400)

    validations = (
            db.query(models.Validation, models.Product.ean)
            .outerjoin(models.Product, models.Validation.wid == models.Product.wid) # <-- Changed to outerjoin
            .filter(models.Validation.timestamp >= sd)
            .filter(models.Validation.timestamp <= ed)
            .all()
        )
    results = []
    for val, ean in validations:
        results.append({
            "validation_id": val.id,
            "wid": val.wid,
            "ean": ean,
            "operator_id": val.operator_id,
            "timestamp": val.timestamp,
            "image_path": val.image_path,
            "status": val.status,
            "ocr_method": val.ocr_method,
            "comments": val.comments,
            "extracted_data": val.extracted_data
        })
        
    return success_response(data=results, message="Reports fetched successfully")

@router.get("/export")
def export_reports(
    start_date: str = Query(..., description="Start date in YYYY-MM-DD format"),
    end_date: str = Query(..., description="End date in YYYY-MM-DD format"),
    format: str = Query("csv"),
    db: Session = Depends(get_db),
    payload: dict = Depends(auth_utils.RoleChecker(["admin", "qa"]))
):
    
    try:
        sd = IST.localize(datetime.strptime(start_date, "%Y-%m-%d"))
        ed = IST.localize(datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59))   
    except ValueError:
        return error_response("Invalid date format.", status_code=400)

    validations = db.query(models.Validation).filter(
        models.Validation.timestamp >= sd,
        models.Validation.timestamp <= ed
    ).all()

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Validation ID", "WID", "Operator", "Timestamp", "Status", "OCR Engine", "Comments", "Data"])
        for val in validations:
            writer.writerow([val.id, val.wid, val.operator_id, val.timestamp, val.status, val.ocr_method, val.comments, val.extracted_data])
        output.seek(0)
        return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=reports.csv"})
    
    elif format == "pdf":
        try:
            from fpdf import FPDF
        except ImportError:
            return error_response("FPDF library missing. Run `pip install fpdf` on server.", status_code=500)
            
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", size=10)
        pdf.cell(200, 10, txt=f"Verification Report ({start_date} to {end_date})", ln=True, align="C")
        pdf.ln(5)
        
        for val in validations:
            pdf.cell(200, 8, txt=f"#{val.id} | WID: {val.wid} | Status: {val.status} | Operator: {val.operator_id}", ln=True)
            if val.comments:
                pdf.cell(200, 8, txt=f"   Comments: {val.comments}", ln=True)
        
        _, temp_path = tempfile.mkstemp(suffix=".pdf")
        pdf.output(temp_path)
        
        def iterfile():
            with open(temp_path, "rb") as f:
                yield from f
        return StreamingResponse(iterfile(), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=reports.pdf"})
