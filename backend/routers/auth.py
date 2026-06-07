from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta, datetime, timezone
import secrets

from backend import auth_utils, models, schemas
from backend.database import get_db
from backend.config import settings
from backend.api_utils import success_response, error_response

router = APIRouter(prefix="/api")

@router.post("/signup", response_model=dict)
def signup(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.username == user_data.username).first()
    if existing_user:
        return error_response("Username already exists", status_code=status.HTTP_400_BAD_REQUEST)
    
    # Restrict roles allowed during self-signup
    role = user_data.role if user_data.role in ["operator", "qa"] else "operator"
    
    new_user = models.User(
        username=user_data.username,
        hashed_password=auth_utils.get_password_hash(user_data.password),
        role=role
    )
    db.add(new_user)
    db.commit()
    return success_response(message="User created successfully. You can now login.")

@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth_utils.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = auth_utils.create_access_token(
        data={"sub": user.username, "role": user.role}, expires_delta=access_token_expires
    )
    
    refresh_token_str = secrets.token_urlsafe(64)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)

    
    db_refresh_token = models.RefreshToken(
        token=refresh_token_str,
        user_id=user.id,
        expires_at=expires_at
    )
    db.add(db_refresh_token)
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username
    }

@router.post("/refresh", response_model=dict)
def refresh_token(req: schemas.RefreshRequest, db: Session = Depends(get_db)):
    db_token = db.query(models.RefreshToken).filter(models.RefreshToken.token == req.refresh_token).first()
    if not db_token:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if db_token.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        db.delete(db_token)
        db.commit()
        raise HTTPException(status_code=401, detail="Refresh token expired")
    
    user = db_token.user
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = auth_utils.create_access_token(
        data={"sub": user.username, "role": user.role}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token}

@router.post("/logout")
def logout(req: schemas.RefreshRequest, db: Session = Depends(get_db)):
    db_token = db.query(models.RefreshToken).filter(models.RefreshToken.token == req.refresh_token).first()
    if db_token:
        db.delete(db_token)
        db.commit()
    return {"detail": "Logged out successfully"}
