import jwt
from auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
    ALGORITHM,
    REFRESH_SECRET_KEY,
    SECRET_KEY,
    create_token,
)
import sqlite3
from datetime import timedelta
from fastapi import HTTPException, Request, Response, status

def verify_token(token: str, secret: str):
    """Mendekode dan memvalidasi JWT token."""
    try:
        payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
        return payload, None
    except jwt.ExpiredSignatureError:
        return None, "expired"
    except jwt.PyJWTError:
        return None, "invalid"


async def get_current_user(request: Request, response: Response) -> dict:
    """Dependency untuk mengambil detail data pengguna dari SQLite & auto-refresh token jika expired."""
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")

    payload, error = (
        verify_token(access_token, SECRET_KEY)
        if access_token
        else (None, "missing")
    )

    # 1. Jika access_token expired atau tidak ada, periksa refresh_token
    if error in ["expired", "missing"]:
        if not refresh_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sesi telah berakhir, silakan login kembali.",
            )

        refresh_payload, refresh_error = verify_token(
            refresh_token, REFRESH_SECRET_KEY
        )

        if refresh_error:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token tidak valid atau expired. Silakan login ulang.",
            )

        username = refresh_payload["sub"]
        role = refresh_payload["role"]
        user_payload = {"sub": username, "role": role}

        # 2. Buat access_token & refresh_token baru
        new_access_token = create_token(
            user_payload, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        new_refresh_token = create_token(
            user_payload,
            timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
            secret=REFRESH_SECRET_KEY,
        )

        # 3. Tulis ulang cookie
        response.set_cookie(
            key="access_token",
            value=new_access_token,
            httponly=True,
            samesite="lax",
            secure=True,
        )
        response.set_cookie(
            key="refresh_token",
            value=new_refresh_token,
            httponly=True,
            samesite="lax",
            secure=True,
        )

    elif error == "invalid":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token autentikasi tidak valid.",
        )
    else:
        # access_token valid
        username = payload["sub"]

    # 4. Ambil detail data pengguna dari database SQLite
    conn = sqlite3.connect("watchers.db")
    conn.row_factory = sqlite3.Row  # Agar query mengembalikan dictionary-like object
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, username, role, room FROM users WHERE username = ?",
        (username,),
    )
    user = cursor.fetchone()
    conn.close()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Pengguna tidak ditemukan dalam sistem.",
        )

    # Mengembalikan dict berisi: {"id": 1, "username": "...", "role": "..."}
    return dict(user)

