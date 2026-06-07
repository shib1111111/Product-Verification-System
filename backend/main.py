from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import logging
import mimetypes

# CRITICAL FIX FOR WINDOWS: Force correct MIME types for Vue ES Modules
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")

from backend.database import engine, SessionLocal, Base
from backend import auth_utils, models
from backend.routers import auth as auth_router
from backend.routers import products, validations, reports, users
from backend.config import settings

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        users_count = db.query(models.User).count()
        if users_count == 0:
            default_users = [
                {"username": settings.default_admin_user, "password": settings.default_admin_pass, "role": "admin"},
            ]
            for u in default_users:
                user = models.User(
                    username=u["username"],
                    hashed_password=auth_utils.get_password_hash(u["password"]),
                    role=u["role"]
                )
                db.add(user)
            db.commit()
    except Exception as e:
        logger.error(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

    os.makedirs("uploads", exist_ok=True)
    os.makedirs("frontend", exist_ok=True)
    yield

app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(products.router)
app.include_router(validations.router)
app.include_router(reports.router)
app.include_router(users.router)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")