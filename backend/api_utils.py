from fastapi import HTTPException, status
from typing import Any, Dict

def success_response(data: Any = None, message: str = "Success", meta: Dict = None) -> dict:
    resp = {
        "status": "success",
        "message": message,
        "data": data
    }
    if meta:
        resp["meta"] = meta
    return resp

def error_response(message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
    raise HTTPException(
        status_code=status_code,
        detail=message
    )