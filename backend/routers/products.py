from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
import uuid, tempfile, shutil, os
import pandas as pd

from backend import auth_utils, models, schemas
from backend.database import get_db
from backend.api_utils import success_response, error_response

router = APIRouter(prefix="/api/products")
UPLOAD_PROGRESS = {}

def process_csv_background(task_id: str, file_path: str):
    UPLOAD_PROGRESS[task_id] = {"status": "processing", "rows_processed": 0, "total_rows": 0}
    db_gen = get_db()
    db = next(db_gen)
    
    try:
        with open(file_path, 'rb') as f:
            total_rows = sum(1 for _ in f) - 1
            UPLOAD_PROGRESS[task_id]["total_rows"] = max(0, total_rows)

        count = 0
        chunksize = 10000 
        
        for chunk in pd.read_csv(file_path, chunksize=chunksize, dtype=str):
            if UPLOAD_PROGRESS[task_id].get("status") == "cancelled":
                break
                
            # Strip spaces from column names for production robustness
            chunk.rename(columns=lambda x: str(x).strip(), inplace=True)    
                
            if 'WID' not in chunk.columns or 'EAN' not in chunk.columns:
                raise ValueError("CSV is missing required 'WID' or 'EAN' columns.")
            
            chunk = chunk.dropna(subset=['WID', 'EAN'])
            chunk = chunk[chunk['WID'].astype(str).str.strip() != '']
            chunk = chunk[chunk['EAN'].astype(str).str.strip() != '']
            
            if chunk.empty: continue
                
            chunk = chunk.where(pd.notnull(chunk), None)
            records = chunk.to_dict('records')
            
            wids = [r.get("WID") for r in records]
            existing_products = db.query(models.Product).filter(models.Product.wid.in_(wids)).all()
            existing_map = {p.wid: p for p in existing_products}
            
            new_products = []
            for row in records:
                wid = row.get("WID")
                if wid in existing_map:
                    existing_product = existing_map[wid]
                    existing_product.ean = row.get("EAN")
                    existing_product.mfg_date = row.get("Manufacturing_Date")
                    existing_product.exp_date = row.get("Expiry_Date")
                else:
                    new_products.append({"wid": wid, "ean": row.get("EAN"), "mfg_date": row.get("Manufacturing_Date"), "exp_date": row.get("Expiry_Date")})
            
            if new_products:
                db.bulk_insert_mappings(models.Product, new_products)
            db.commit()
            
            count += len(records)
            UPLOAD_PROGRESS[task_id]["rows_processed"] = count
            
        if UPLOAD_PROGRESS[task_id].get("status") != "cancelled":
            UPLOAD_PROGRESS[task_id]["status"] = "completed"

    except Exception as e:
        UPLOAD_PROGRESS[task_id]["status"] = "failed"
        UPLOAD_PROGRESS[task_id]["error"] = str(e)
    finally:
        try: next(db_gen)
        except StopIteration: pass
        if os.path.exists(file_path): os.remove(file_path)

@router.post("/upload-csv")
def upload_csv(background_tasks: BackgroundTasks, file: UploadFile = File(...), payload: dict = Depends(auth_utils.RoleChecker(["admin"]))):
    if not file.filename.endswith('.csv'):
        return error_response("Invalid file format. Must be CSV.", status_code=400)
    
    task_id = str(uuid.uuid4())
    fd, temp_path = tempfile.mkstemp(suffix=".csv")
    with os.fdopen(fd, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    background_tasks.add_task(process_csv_background, task_id, temp_path)
    return success_response(message="Upload processing started in the background.", data={"task_id": task_id})

@router.get("/upload-status/{task_id}")
def get_upload_status(task_id: str, payload: dict = Depends(auth_utils.RoleChecker(["admin"]))):
    status_data = UPLOAD_PROGRESS.get(task_id)
    if not status_data: return error_response("Task not found", status_code=404)
    return success_response(message="Task status retrieved successfully", data=status_data)

@router.post("/cancel-upload/{task_id}")
def cancel_upload(
    task_id: str,
    payload: dict = Depends(auth_utils.RoleChecker(["admin"]))
):
    status_data = UPLOAD_PROGRESS.get(task_id)
    if not status_data:
        return error_response("Task not found", status_code=404)
    if status_data["status"] == "processing":
        UPLOAD_PROGRESS[task_id]["status"] = "cancelled"
        return success_response(message="Upload cancelled successfully.")
    return error_response("Task is not in a cancellable state", status_code=400)

@router.get("/{wid}", response_model=schemas.Product)
def get_product(
    wid: str,
    db: Session = Depends(get_db),
    payload: dict = Depends(auth_utils.RoleChecker(["admin", "operator"]))
):
    product = db.query(models.Product).filter(models.Product.wid == wid).first()
    if not product:
        return error_response("Product not found", status_code=404)
    return product
