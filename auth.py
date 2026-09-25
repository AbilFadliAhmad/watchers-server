import os
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import bcrypt
import sqlite3

# Insialisasi Environtment
load_dotenv()

# Konfigurasi Keamanan JWT
SECRET_KEY = os.environ.get("SECRET_KEY")
REFRESH_SECRET_KEY = os.environ.get("REFRESH_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Inisialisasi Rute
router = APIRouter()

# --- HELPER BCRYPT MURNI ---
def hash_password(password: str) -> str:
    """Mengubah plain password menjadi hash string bcrypt."""
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Memverifikasi kecocokan plain password dengan hash string."""
    password_bytes = plain_password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hashed_bytes)


# --- UTILITY JWT ---
def create_token(
    data: dict, expires_delta: timedelta, secret: str = SECRET_KEY
):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, secret, algorithm=ALGORITHM)


class LoginSchema(BaseModel):
    username: str
    password: str


# --- ENDPOINT LOGIN ---
@router.post("/api/login")
async def login(credentials: LoginSchema):
    conn = sqlite3.connect("watchers.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM users WHERE username = ?", (credentials.username,)
    )
    user = cursor.fetchone()
    conn.close()

    # Validasi Pengguna & Password
    if not user or not verify_password(
        credentials.password, user["password_hash"]
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username atau password salah.",
        )

    # Buat Access Token & Refresh Token
    token_payload = {"sub": user["username"], "role": user["role"]}
    access_token = create_token(
        token_payload, timedelta(minutes=1)
    )

    refresh_token = create_token(
        token_payload,
        timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        secret=REFRESH_SECRET_KEY,
    )

    # Simpan Token ke dalam HttpOnly Cookie
    res = JSONResponse(
        content={
            "status": "success",
            "message": "Login berhasil",
            "role": user["role"],
        }
    )

    res.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=True,  # Ubah ke True pada domain HTTPS
    )

    res.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=True,  # Ubah ke True pada domain HTTPS
    )

    return res

@router.post("/api/logout")
async def logout():
    """Menghapus cookie autentikasi."""
    res = JSONResponse(
        content={"status": "success", "message": "Berhasil logout"}
    )
    res.delete_cookie("access_token")
    res.delete_cookie("refresh_token")
    return res