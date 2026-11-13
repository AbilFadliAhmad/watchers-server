import os
import time
import sqlite3
import bcrypt
from collections import defaultdict
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api", tags=["Security"])

# Penyimpanan percobaan gagal per IP (Anti Brute-Force)
_FAILED_ATTEMPTS: dict[str, list[float]] = defaultdict(list)
MAX_ATTEMPTS = 5
WINDOW_SECONDS = 60  # Blokir sementara 1 menit setelah 5x salah


class VerifyUninstallRequest(BaseModel):
    admin_password: str = Field(..., min_length=1, max_length=128)


def _is_rate_limited(client_ip: str) -> bool:
    now = time.time()
    # Bersihkan riwayat percobaan yang sudah lewat dari WINDOW_SECONDS
    _FAILED_ATTEMPTS[client_ip] = [
        ts for ts in _FAILED_ATTEMPTS[client_ip] if now - ts < WINDOW_SECONDS
    ]
    return len(_FAILED_ATTEMPTS[client_ip]) >= MAX_ATTEMPTS


def _record_failed_attempt(client_ip: str) -> None:
    _FAILED_ATTEMPTS[client_ip].append(time.time())


def _get_admin_password_hash() -> bytes | None:
    """
    Mengambil hash bcrypt password master admin.
    Sesuaikan query SQLite di bawah dengan nama tabel/kolom admin di Watchers Server Anda,
    atau set env var UNINSTALL_MASTER_HASH.
    """
    # Opsi 2: Dari SQLite Watchers Server (contoh tabel users / admins)
    db_path = "watchers.db"
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        try:
            cursor = conn.cursor()
            # Sesuaikan nama tabel & kolom dengan skema database server Anda
            cursor.execute("SELECT password FROM client_password WHERE id = 1;")
            row = cursor.fetchone()
            if row and row[0]:
                return row[0].encode("utf-8")
        finally:
            conn.close()

    return None


@router.post("/verify-uninstall")
async def verify_uninstall_password(
    payload: VerifyUninstallRequest,
    request: Request,
):
    client_ip = request.client.host if request.client else "unknown"

    if _is_rate_limited(client_ip):
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "success": False,
                "valid": False,
                "message": "Terlalu banyak percobaan gagal. Coba lagi dalam 1 menit.",
            },
        )

    stored_hash = _get_admin_password_hash()
    if not stored_hash:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Konfigurasi password master admin belum diatur di server.",
        )

    input_bytes = payload.admin_password.strip().encode("utf-8")

    try:
        is_valid = bcrypt.checkpw(input_bytes, stored_hash)
    except ValueError:
        is_valid = False

    if not is_valid:
        _record_failed_attempt(client_ip)
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={
                "success": False,
                "valid": False,
                "message": "Kata sandi master admin tidak valid.",
            },
        )

    # Reset hitungan gagal jika berhasil
    _FAILED_ATTEMPTS.pop(client_ip, None)

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "valid": True,
            "message": "Otorisasi uninstall berhasil.",
        },
    )