from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend import auth_utils, models
from backend.database import get_db
from backend.api_utils import success_response, error_response

router = APIRouter(prefix="/api/users")

class UserCreate(BaseModel):
    username: str
    password: str
    role: str

@router.get("/")
def get_users(
    db: Session = Depends(get_db),
    payload: dict = Depends(auth_utils.RoleChecker(["admin"]))
):
    users = db.query(models.User).all()
    # Don't send password hashes back to the client!
    user_data = [{"id": u.id, "username": u.username, "role": u.role} for u in users]
    return success_response(data=user_data)

@router.post("/")
def create_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(auth_utils.RoleChecker(["admin"]))
):
    print(f"Attempting to create user: {user.username} with role: {user.role}")
    if user.role not in ["operator", "qa", "admin"]:
        return error_response("Invalid role.", status_code=400)
    print(f"Attempting to create user: {user.username} with role: {user.role}")
    existing = db.query(models.User).filter(models.User.username == user.username).first()
    if existing:
        return error_response("Username already exists", status_code=400)
        
    new_user = models.User(
        username=user.username,
        hashed_password=auth_utils.get_password_hash(user.password),
        role=user.role
    )
    db.add(new_user)
    db.commit()
    return success_response(message=f"User '{user.username}' created successfully as a {user.role.upper()}.")

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(auth_utils.RoleChecker(["admin"]))
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return error_response("User not found.", status_code=404)
        
    # Prevent the admin from deleting themselves
    if user.username == payload.get("sub"):
        return error_response("You cannot delete your own admin account.", status_code=400)
        
    # Clear out any active sessions/tokens for this user before deleting them
    db.query(models.RefreshToken).filter(models.RefreshToken.user_id == user.id).delete()
    
    db.delete(user)
    db.commit()
    return success_response(message=f"User '{user.username}' has been deleted.")