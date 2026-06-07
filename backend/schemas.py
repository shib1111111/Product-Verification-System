from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    username: str

class RefreshRequest(BaseModel):
    refresh_token: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "operator"  # default role for open signups

class ProductBase(BaseModel):
    wid: str
    ean: str
    mfg_date: str
    exp_date: str

class Product(ProductBase):
    class Config:
        from_attributes = True

class ValidationBase(BaseModel):
    wid: str
    operator_id: str
    timestamp: datetime
    image_path: str
    status: Optional[str] = None
    ocr_method: Optional[str] = None
    extracted_data: Optional[str] = None
    comments: Optional[str] = None
    gemini_notes: Optional[str] = None

class Validation(ValidationBase):
    id: int
    class Config:
        from_attributes = True

class ReportRow(BaseModel):
    validation_id: int
    wid: str
    ean: str
    operator_id: str
    timestamp: datetime
    image_path: str
    status: Optional[str] = None
    ocr_method: Optional[str] = None
    extracted_data: Optional[str] = None
    comments: Optional[str] = None
    gemini_notes: Optional[str] = None
