from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from backend.database import Base
from datetime import datetime
import pytz

# Define Kolkata Timezone
IST = pytz.timezone("Asia/Kolkata")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String) # 'admin', 'operator', 'qa'
    is_active = Column(Boolean, default=True)
    
class Warehouse(Base):
    __tablename__= "warehouse"
    id = Column(Integer, primary_key=True, index=True)
    warename = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String) # 'admin', 'operator', 'qa'
    is_active = Column(Boolean, default=True)

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    expires_at = Column(DateTime)
    
    user = relationship("User")

class Product(Base):
    __tablename__ = "products"
    wid = Column(String, primary_key=True, index=True)
    ean = Column(String, index=True)
    mfg_date = Column(String)
    exp_date = Column(String)

class Validation(Base):
    __tablename__ = "validations"
    id = Column(Integer, primary_key=True, index=True)
    wid = Column(String, ForeignKey("products.wid"), index=True)
    operator_id = Column(String, index=True) 
    timestamp = Column(DateTime, default=lambda: datetime.now(IST)) # <-- pytz IST
    image_path = Column(String)
    gemini_notes = Column(String, nullable=True)
    status = Column(String, nullable=True)
    ocr_method = Column(String, nullable=True)
    extracted_data = Column(String, nullable=True)
    comments = Column(String, nullable=True)
    
    product = relationship("Product")