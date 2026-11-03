import sqlite3
from typing import Optional
import uuid
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from auth import hash_password
from auth_middleware import get_current_user
import hashlib
import os
from fastapi import File, Form, HTTPException, UploadFile, status
from client_helper import delete_installer_meta, parse_version_from_filename, save_installer_meta, set_active_installer_config
import re

router = APIRouter(prefix="/api", tags=["Management"])
DB_NAME = "watchers.db"

# --- HELPER: GET ALL ROOMS & USERS ---
async def get_management_data(user_role: str) -> dict:
    """Mengambil seluruh data manajemen (rooms, roles, users, installers)
    dalam 1 kali buka-tutup koneksi database.
    """
    empty_result = {"rooms": [], "roles": [], "users": [], "installers": []}

    # Hak akses khusus manajemen
    if user_role not in ["admin"]:
        return empty_result

    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        # 1. Ambil Rooms
        cursor.execute("SELECT id, name FROM rooms ORDER BY id ASC")
        rooms = [dict(row) for row in cursor.fetchall()]

        # 2. Ambil Roles
        cursor.execute("SELECT id, name FROM roles ORDER BY id ASC")
        roles = [dict(row) for row in cursor.fetchall()]

        # 3. Ambil Users (JOIN ke Roles & Rooms)
        cursor.execute("""
            SELECT 
                u.id, 
                u.username, 
                r.name AS role, 
                rm.name AS room
            FROM users u
            INNER JOIN roles r ON u.role_id = r.id
            INNER JOIN rooms rm ON u.room_id = rm.id
            ORDER BY u.id ASC
        """)
        users = [dict(row) for row in cursor.fetchall()]

        # 4. Ambil Installers OTA
        cursor.execute(
            "SELECT name, version, url, sha256 FROM agent_installers ORDER BY id DESC"
        )
        installer_rows = cursor.fetchall()

        WATCHER_FILENAME_REGEX = re.compile(
            r"^WatchersAgent-v\d+\.\d+\.\d+-(x64|x86|arm64)\.exe$", re.IGNORECASE
        )
        installers = [
            dict(row) for row in installer_rows if WATCHER_FILENAME_REGEX.match(row["name"])
        ]

        return {
            "rooms": rooms,
            "roles": roles,
            "users": users,
            "installers": installers,
        }

    finally:
        conn.close()

# --- HELPER FUNCTION: MENCATAT LOG AKTIVITAS ---
def record_activity_log(client_id: str, action_type: str, details: str, executed_by: str, is_warning: bool | str = False):
    """
    Mencatat aktivitas perintah ke tabel activity_logs.
    Jika parameter is_warning bernilai True / 'iya', data juga akan disimpan ke tabel user_violations.
    """
    try:
        conn = sqlite3.connect("watchers.db")
        cursor = conn.cursor()

        # 1. Selalu catat ke tabel activity_logs (Riwayat Umum)
        cursor.execute(
            """
            INSERT INTO activity_logs (client_id, action_type, details, executed_by)
            VALUES (?, ?, ?, ?)
            """,
            (client_id, action_type, details, executed_by)
        )

        # 2. Cek apakah status pelanggaran/peringatan aktif (bisa berupa boolean True atau string 'iya')
        is_violation = is_warning in [True, "iya", "true", "True", 1]

        if is_violation:
            cursor.execute(
                """
                INSERT INTO user_violations (client_id, action_type, details, executed_by)
                VALUES (?, ?, ?, ?)
                """,
                (client_id, action_type, details, executed_by)
            )

        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Gagal mencatat log aktivitas/pelanggaran: {e}")

# --- HELPER: MENGAMBIL DATA LOGS ---
async def get_logs_data(
    current_user: dict, 
    action: Optional[str] = None, 
    time_range: str = "1w", 
) -> dict:
    """
    Mengambil data pelanggaran (user_violations) dan log aktivitas (activity_logs) dari database.
    Filter otomatis berdasarkan room pengguna, jenis aksi, dan kurun waktu.
    """

    from main import TIME_RANGE_MAP
    
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    user_room = current_user.get("room", "all").lower()
    user_role = current_user.get("role", "").lower()
    time_modifier = TIME_RANGE_MAP.get(time_range, "-7 days")

    # -------------------------------------------------------------
    # 1. Query Data Pelanggaran (user_violations)
    # -------------------------------------------------------------
    v_where = ["v.created_at >= datetime('now', ?)"]
    v_params = [time_modifier]

    if user_room != "all" and user_role not in ["admin", "developer", "direktur"]:
        v_where.append("LOWER(c.name) LIKE ?")
        v_params.append(f"{user_room}%")

    if action and action.strip():
        v_where.append("v.action_type = ?")
        v_params.append(action.strip())

    v_sql_where = f"WHERE {' AND '.join(v_where)}"

    v_query = f"""
        SELECT 
            v.id,
            v.client_id,
            COALESCE(c.name, v.client_id) AS hostname,
            v.action_type,
            v.details,
            u.username AS executed_by_username,
            v.created_at
        FROM user_violations v
        LEFT JOIN clients c ON v.client_id = c.id
        LEFT JOIN users u ON v.executed_by = u.id
        {v_sql_where}
        ORDER BY v.id DESC
    """
    cursor.execute(v_query, tuple(v_params))
    violations = [dict(row) for row in cursor.fetchall()]

    # -------------------------------------------------------------
    # 2. Query Data Log Aktivitas Umum (activity_logs)
    # -------------------------------------------------------------
    l_where = ["l.created_at >= datetime('now', ?)"]
    l_params = [time_modifier]

    if user_room != "all" and user_role not in ["admin", "developer", "direktur"]:
        l_where.append("LOWER(c.name) LIKE ?")
        l_params.append(f"{user_room}%")

    if action and action.strip():
        l_where.append("l.action_type = ?")
        l_params.append(action.strip())

    l_sql_where = f"WHERE {' AND '.join(l_where)}"

    l_query = f"""
        SELECT 
            l.id,
            l.client_id,
            COALESCE(c.name, l.client_id) AS hostname,
            l.action_type,
            l.details,
            u.username AS executed_by_username,
            l.created_at
        FROM activity_logs l
        LEFT JOIN clients c ON l.client_id = c.id
        LEFT JOIN users u ON l.executed_by = u.id
        {l_sql_where}
        ORDER BY l.id DESC
    """
    cursor.execute(l_query, tuple(l_params))
    logs = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return {
        "status": "success",
        "violations": violations,
        "logs": logs
    }

# --- HELPER : GET DATA CONFIG STREAMING ---
def fetch_stream_config_from_db():
    """Mengambil konfigurasi dari SQLite dan menyusunnya ke dict RAM."""
    config = {}
    try:
        conn = sqlite3.connect("watchers.db")
        cursor = conn.cursor()
        cursor.execute(
            "SELECT mode, quality, scale_width, scale_height, interval FROM stream_settings"
        )
        rows = cursor.fetchall()
        conn.close()

        for row in rows:
            mode, quality, scale_width, scale_height, interval = row
            scale = ([int(scale_width), int(scale_height)])
            config[mode] = {
                "quality": quality,
                "scale": scale,
                "interval": interval,
            }
    except Exception as e:
        print(f"[!] Gagal membaca stream_settings dari DB: {e}")
        # Default fallback jika DB bermasalah
        config = {
            "grid": {"quality": 50, "scale": [640, 360], "interval": 5.0},
            "fullscreen": {
                "quality": 70,
                "scale": [1280, 720],
                "interval": 0.066,
            },
        }
    return config

# --- PYDANTIC SCHEMAS ---
class RoomCreateSchema(BaseModel):
    name: str = Field(..., min_length=2, example="lab_komputer_1") # type: ignore
    
class UserCreateSchema(BaseModel):
    username: str = Field(..., min_length=3, example="dosen_pembimbing")
    password: str = Field(..., min_length=3, example="password123")
    role: str = Field(..., example="dosen")  # dosen, direktur, developer
    room: Optional[str] = Field("teachers", example="teachers")


# --- ENDPOINT 1: UPDATE PROFIL ---

# Schema Request Body
class ProfileUpdateRequest(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    room: Optional[str] = None


@router.put("/user/profile")
async def update_user_profile(
    payload: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["id"]
    current_username = current_user["username"]
    is_admin = current_user["role"] == "admin"

    update_fields = []
    params = []

    # 1. Validasi & Update Username
    if payload.username and payload.username.strip() != current_username:
        new_username = payload.username.strip()

        # Cek apakah username baru sudah digunakan oleh akun lain
        conn = sqlite3.connect("watchers.db")
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id FROM users WHERE username = ? AND id != ?",
            (new_username, user_id),
        )
        existing_user = cursor.fetchone()
        conn.close()

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username tersebut sudah digunakan oleh akun lain.",
            )

        update_fields.append("username = ?")
        params.append(new_username)

    # 2. Validasi & Update Password (Hanya jika diisi)
    if payload.password and payload.password.strip():
        hashed_password = hash_password(payload.password)
        update_fields.append("password_hash = ?")
        params.append(hashed_password)

    # 3. KONTROL HAK AKSES: Hanya ADMIN yang bisa memperbarui 'role' dan 'room'
    if is_admin:
        if payload.role and payload.role.strip():
            update_fields.append("role = ?")
            params.append(payload.role.strip())

        if payload.room and payload.room.strip():
            update_fields.append("room = ?")
            params.append(payload.room.strip())

    # Jika tidak ada field yang diubah
    if not update_fields:
        return {
            "status": "success",
            "message": "Tidak ada perubahan data profil.",
        }

    # 4. Eksekusi Query Update ke Database
    params.append(user_id)
    query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = ?"

    try:
        conn = sqlite3.connect("watchers.db")
        cursor = conn.cursor()
        cursor.execute(query, tuple(params))
        conn.commit()
        conn.close()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memperbarui data profil: {str(e)}",
        )

    return {
        "status": "success",
        "message": "Profil berhasil diperbarui.",
        "updated_by_admin": is_admin,
    }

@router.post("/rooms", status_code=status.HTTP_201_CREATED)
async def create_room(room_data: RoomCreateSchema):
    room_name = room_data.name.strip().lower()

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    # Cek apakah room sudah ada
    cursor.execute("SELECT id FROM rooms WHERE name = ?", (room_name,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Room '{room_name}' sudah terdaftar.",
        )

    # Insert room baru
    cursor.execute("INSERT INTO rooms (name) VALUES (?)", (room_name,))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()

    return {
        "status": "success",
        "message": f"Room '{room_name}' berhasil dibuat.",
        "data": {"id": new_id, "name": room_name},
    }


# --- PYDANTIC UPDATE SCHEMAS ---
class RoomUpdateSchema(BaseModel):
    name: str = Field(..., min_length=2, example="lab_komputer_2")
# --- ENDPOINT 5: EDIT ROOM ---
@router.put("/rooms/{room_id}", status_code=status.HTTP_200_OK)
async def update_room(room_id: int, room_data: RoomUpdateSchema):
    new_name = room_data.name.strip().lower()

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")

    # 1. Cek apakah room ada
    cursor.execute("SELECT name FROM rooms WHERE id = ?", (room_id,))
    existing_room = cursor.fetchone()
    if not existing_room:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room tidak ditemukan.",
        )

    old_name = existing_room[0]

    # Mencegah pengubahan nama room 'teachers'
    if old_name == "teachers":
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nama room default 'teachers' tidak boleh diubah.",
        )

    # 2. Cek apakah nama baru sudah dipakai room lain
    cursor.execute(
        "SELECT id FROM rooms WHERE name = ? AND id != ?", (new_name, room_id)
    )
    if cursor.fetchone():
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Room '{new_name}' sudah ada.",
        )

    # Update nama room (ON UPDATE CASCADE akan otomatis memperbarui kolom room di tabel users)
    cursor.execute(
        "UPDATE rooms SET name = ? WHERE id = ?", (new_name, room_id)
    )
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "message": f"Nama room berhasil diubah dari '{old_name}' menjadi '{new_name}'.",
    }

# --- ENDPOINT 3: DELETE ROOM ---
@router.delete("/rooms/{room_id}", status_code=status.HTTP_200_OK)
async def delete_room(room_id: int):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")

    # Cek keberadaan room
    cursor.execute("SELECT name FROM rooms WHERE id = ?", (room_id,))
    room = cursor.fetchone()
    if not room:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room tidak ditemukan.",
        )

    room_name = room[0]

    # Mencegah penghapusan room default 'teachers'
    if room_name == "teachers":
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Room default 'teachers' tidak dapat dihapus.",
        )

    # Cek apakah masih ada user yang terikat ke room ini
    cursor.execute(
        "SELECT COUNT(*) FROM users WHERE room = ?", (room_name,)
    )
    user_count = cursor.fetchone()[0]
    if user_count > 0:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tidak bisa menghapus room '{room_name}' karena masih digunakan oleh {user_count} user.",
        )

    cursor.execute("DELETE FROM rooms WHERE id = ?", (room_id,))
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "message": f"Room '{room_name}' berhasil dihapus.",
    }

# --- ENDPOINT 2: REGISTER USER BARU ---
@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user(user_data: UserCreateSchema):
    role_name = user_data.role.strip().lower()
    room_name = user_data.room.strip().lower() if user_data.room else "teachers"

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")

    # 1. Cek apakah username sudah dipakai
    cursor.execute(
        "SELECT id FROM users WHERE username = ?", (user_data.username,)
    )
    if cursor.fetchone():
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username '{user_data.username}' sudah digunakan.",
        )

    # 2. Cek keberadaan Role & ambil role_id
    cursor.execute("SELECT id FROM roles WHERE LOWER(name) = ?", (role_name,))
    role_row = cursor.fetchone()
    if not role_row:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role '{role_name}' tidak ditemukan.",
        )
    role_id = role_row[0]

    # 3. Cek keberadaan Room & ambil room_id
    cursor.execute("SELECT id FROM rooms WHERE LOWER(name) = ?", (room_name,))
    room_row = cursor.fetchone()
    if not room_row:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Room '{room_name}' tidak ditemukan. Buat room terlebih dahulu.",
        )
    room_id = room_row[0]

    # 4. Hash password dan simpan user baru menggunakan role_id & room_id
    hashed_pwd = hash_password(user_data.password)
    cursor.execute(
        "INSERT INTO users (id, username, password_hash, role_id, room_id) VALUES (?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), user_data.username, hashed_pwd, role_id, room_id),
    )

    conn.commit()
    new_user_id = cursor.lastrowid
    conn.close()

    return {
        "status": "success",
        "message": f"User '{user_data.username}' berhasil dibuat.",
        "data": {
            "id": new_user_id,
            "username": user_data.username,
            "role": role_name,
            "room": room_name,
        },
    }

class UserUpdateSchema(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    room: Optional[str] = None


# --- ENDPOINT 6: EDIT USER ---
@router.put("/users/{user_id}", status_code=status.HTTP_200_OK)
async def update_user(user_id: int, user_data: UserUpdateSchema):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")

    # Cek apakah user ada
    cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User tidak ditemukan.",
        )

    updates = []
    params = []

    # Update Username
    if user_data.username:
        new_username = user_data.username.strip()
        cursor.execute(
            "SELECT id FROM users WHERE username = ? AND id != ?",
            (new_username, user_id),
        )
        if cursor.fetchone():
            conn.close()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Username '{new_username}' sudah digunakan.",
            )
        updates.append("username = ?")
        params.append(new_username)

    # Update Password (jika diisi)
    if user_data.password and user_data.password.strip():
        updates.append("password_hash = ?")
        params.append(hash_password(user_data.password.strip()))

    # Update Role (Cek keberadaan role & ambil role_id)
    if user_data.role:
        role_name = user_data.role.strip().lower()
        cursor.execute("SELECT id FROM roles WHERE LOWER(name) = ?", (role_name,))
        role_row = cursor.fetchone()
        if not role_row:
            conn.close()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Role '{role_name}' tidak ditemukan.",
            )
        updates.append("role_id = ?")
        params.append(role_row[0])

    # Update Room (Cek keberadaan room & ambil room_id)
    if user_data.room:
        room_name = user_data.room.strip().lower()
        cursor.execute("SELECT id FROM rooms WHERE LOWER(name) = ?", (room_name,))
        room_row = cursor.fetchone()
        if not room_row:
            conn.close()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Room '{room_name}' tidak ditemukan.",
            )
        updates.append("room_id = ?")
        params.append(room_row[0])

    if not updates:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tidak ada data yang diubah.",
        )

    params.append(user_id)
    query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
    cursor.execute(query, params)
    conn.commit()
    conn.close()

    return {"status": "success", "message": "Data user berhasil diperbarui."}

# --- ENDPOINT 4: DELETE USER ---
@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
async def delete_user(user_id: int):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    # Cek keberadaan user
    cursor.execute("SELECT username FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User tidak ditemukan.",
        )

    username = user[0]

    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "message": f"User '{username}' berhasil dihapus.",
    }

class RoleCreateSchema(BaseModel):
    name: str


# --- ENDPOINT 1: CREATE ROLE ---
@router.post("/roles", status_code=status.HTTP_201_CREATED)
async def create_role(
    role_data: RoleCreateSchema,
    current_user: dict = Depends(get_current_user),
):
    # Proteksi Hak Akses
    if current_user.get("role") not in ["admin", "direktur", "developer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak. Hanya administrator yang dapat membuat role.",
        )

    role_name = role_data.name.strip().lower()

    if not role_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nama role tidak boleh kosong.",
        )

    # Dilarang membuat role dengan nama 'admin' secara manual
    if role_name == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role 'admin' adalah role sistem dan tidak dapat dibuat ulang.",
        )

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    # Cek duplikasi nama role
    cursor.execute("SELECT id FROM roles WHERE LOWER(name) = ?", (role_name,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{role_name}' sudah terdaftar.",
        )

    # Insert role baru
    cursor.execute("INSERT INTO roles (name) VALUES (?)", (role_name,))
    conn.commit()
    new_role_id = cursor.lastrowid
    conn.close()

    return {
        "status": "success",
        "message": f"Role '{role_name}' berhasil dibuat.",
        "data": {"id": new_role_id, "name": role_name},
    }


# --- ENDPOINT 2: DELETE ROLE ---
@router.delete("/roles/{role_name}", status_code=status.HTTP_200_OK)
async def delete_role(
    role_name: str, current_user: dict = Depends(get_current_user)
):
    # Proteksi Hak Akses
    if current_user.get("role") != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak. Hanya administrator yang dapat menghapus role.",
        )

    target_role = role_name.strip().lower()

    # Proteksi Khusus: Role bawaan sistem tidak boleh dihapus
    if target_role == 'admin':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role bawaan '{target_role}' tidak dapat dihapus.",
        )

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")

    # Cek keberadaan role
    cursor.execute("SELECT id FROM roles WHERE LOWER(name) = ?", (target_role,))
    role_row = cursor.fetchone()
    if not role_row:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role '{target_role}' tidak ditemukan.",
        )

    role_id = role_row[0]

    # Cek apakah masih ada user yang terikat dengan role_id ini
    cursor.execute("SELECT COUNT(*) FROM users WHERE role_id = ?", (role_id,))
    user_count = cursor.fetchone()[0]
    if user_count > 0:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{target_role}' masih digunakan oleh {user_count} pengguna.",
        )

    # Hapus role
    cursor.execute("DELETE FROM roles WHERE id = ?", (role_id,))
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "message": f"Role '{target_role}' berhasil dihapus.",
    }

# --- ROUTE ENDPOINT API ---
@router.put("/stream-settings")
async def api_update_stream_settings(request: Request, response: Response, payload: dict):
    """
    Payload: { "grid": { quality, scale_width, scale_height, interval },
    "fullscreen": { ... } }
    """
    # 1. Proteksi Autentikasi Role
    # Ganti dengan fungsi middleware auth Anda
    user = await get_current_user(request, response)
    if user.get("role") not in ["direktur", "developer"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )
    
    conn = sqlite3.connect("watchers.db")
    cursor = conn.cursor()
    try:
        # 0. Persiapkan data payload
        data = payload
    
        # 1. Update Mode Grid
        if "grid" in data:
            grid = data["grid"]
            cursor.execute(
                """
                UPDATE stream_settings
                SET quality = ?, scale_width = ?, scale_height = ?, interval = ?
                WHERE mode = 'grid'
            """,
                (
                    grid["quality"],
                    grid["scale_width"],
                    grid["scale_height"],
                    grid["interval"],
                ),
            )

        # 2. Update Mode Fullscreen
        if "fullscreen" in data:
            fs = data["fullscreen"]
            cursor.execute(
                """
                UPDATE stream_settings
                SET quality = ?, scale_width = ?, scale_height = ?, interval = ?
                WHERE mode = 'fullscreen'
            """,
                (
                    fs["quality"],
                    fs["scale_width"],
                    fs["scale_height"],
                    fs["interval"],
                ),
            )
        conn.commit()

        # 3. Mengubah variabel global STREAM_CONFIG di RAM & memancarkan via Socket.IO
        from main import broadcast_stream_config
        await broadcast_stream_config()

        # 4. Kembalikan response sukses
        return {
            "status": "success",
            "message": "Konfigurasi stream berhasil diperbarui dan disiarkan.",
        }

    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=500, detail=f"Gagal memperbarui konfigurasi: {str(e)}"
        )
    finally:
            conn.close()

def update_client_name_in_db(device_id: str, new_name: str):
    """
    Memperbarui kolom 'name' untuk device_id tertentu pada tabel 'clients'.
    """
    conn = sqlite3.connect("watchers.db")
    cursor = conn.cursor()
    try:
        print(f"[] Updating client name in DB: device_id={device_id}, new_name={new_name}")
        cursor.execute(
            """
            UPDATE clients
            SET name = ?
            WHERE id = ?
            """,
            (new_name, device_id),
        )
        conn.commit()
        cursor.execute("SELECT * FROM clients")
    except Exception as e:
        conn.rollback()
        print(f"[!] Error update_client_name_in_db: {e}", flush=True)
        raise e
    finally:
        conn.close()

class RenameClientSchema(BaseModel):
    device_id: str
    new_name: str

@router.put("/clients/rename")
async def api_rename_client(request: Request, payload: RenameClientSchema):
    """
    Endpoint untuk mengubah nama perangkat berdasarkan device_id (sid).
    """
    if not payload.device_id or not payload.new_name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Device ID dan Nama Baru harus diisi."
        )

    try:
        # 1. Update nama di SQLite Database
        update_client_name_in_db(payload.device_id, payload.new_name.strip())

        # 2. Update status in-memory RAM (connected_students)
        from main import connected_students, sio
        if payload.device_id in connected_students:
            connected_students[payload.device_id]["name"] = payload.new_name.strip()

        # 3. Siarkan perubahan ke seluruh Dashboard Guru secara real-time
        await sio.emit(
            "student_renamed",
            {
                "device_id": payload.device_id,
                "hostname": payload.new_name.strip()
            },
            room="teachers"
        )

        return {
            "status": "success",
            "message": "Nama PC berhasil diperbarui."
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengubah nama PC: {str(e)}"
        )

@router.post("/upload-installer-chunk")
async def upload_installer_chunk(
    chunk: UploadFile = File(...),
    filename: str = Form(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    client_sha256: str = Form(...),
    start_date: str = Form(...),  # Menerima timestamp awal dari client
):
    if not filename.endswith(".exe") or not filename.startswith(
        "WatchersAgent"
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Nama file harus diawali dengan 'WatchersAgent' dan beresktensi"
                " .exe!"
            ),
        )
    from main import UPLOAD_DIR
    temp_filename = f"chunk_{start_date}_{filename}"
    temp_filepath = os.path.join(UPLOAD_DIR, temp_filename)
    final_filepath = os.path.join(UPLOAD_DIR, filename)

    # Chunk 0 tulis ulang file baru, chunk berikutnya gunakan mode append
    write_mode = "wb" if chunk_index == 0 else "ab"

    with open(temp_filepath, write_mode) as f:
        f.write(await chunk.read())

    # Jika ini adalah chunk terakhir, lakukan verifikasi SHA-256 dan pindahkan file
    if chunk_index == total_chunks - 1:
        sha256_hash = hashlib.sha256()
        with open(temp_filepath, "rb") as f:
            while content := f.read(1024 * 1024):
                sha256_hash.update(content)

        server_sha256 = sha256_hash.hexdigest().lower()

        if server_sha256 != client_sha256.lower():
            if os.path.exists(temp_filepath):
                os.remove(temp_filepath)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Integritas file gagal! Hash SHA-256 server tidak cocok"
                    " dengan client."
                ),
            )

        os.replace(temp_filepath, final_filepath)

        version = parse_version_from_filename(filename)
        file_url = f"/downloads/{filename}"

        await save_installer_meta(
            name=filename, version=version, url=file_url, sha256=server_sha256
        )

        return {
            "status": "success",
            "message": "Upload dan verifikasi SHA-256 selesai!",
            "data": {
                "name": filename,
                "version": version,
                "url": file_url,
                "sha256": server_sha256,
            },
        }

    return {"status": "chunk_received", "chunk_index": chunk_index}

# Definisikan Schema Request Body
class SelectInstallerRequest(BaseModel):
    name: str
    version: str
    url: str
    sha256: str

@router.post("/select-installer")
async def select_installer(payload: SelectInstallerRequest):
    """
    Endpoint untuk memilih versi agent, memperbarui variabel global di main,
    menyimpan ke database active_ota_config (1 baris), dan menyiarkan perintah update ke client.
    """
    try:
        # Import main di dalam blok fungsi sesuai kebutuhan
        import main

        # 1. Perbarui variabel global langsung pada atribut modul 'main'
        main.CURRENT_VERSION = payload.version
        main.CURRENT_SHA256 = payload.sha256
        main.CURRENT_URL_DOWNLOAD = payload.url

        # 2. Simpan ke database (menimpa baris tunggal)
        set_active_installer_config(
            name=payload.name,
            version=payload.version,
            url=payload.url,
            sha256=payload.sha256
        )

        return {
            "status": "success",
            "message": f"Versi v{payload.version} berhasil dipilih dan disiarkan!",
            "active_config": {
                "name": payload.name,
                "version": payload.version,
                "url": payload.url,
                "sha256": payload.sha256
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memproses pemilihan versi: {str(e)}"
        )

# Model Request Payload
class DeleteInstallerRequest(BaseModel):
    filename: str

@router.delete("/delete-installer")
async def delete_installer(payload: DeleteInstallerRequest):
    filename = payload.filename

    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Nama file tidak valid.")

    installer_dir = os.path.join(os.getcwd(), "downloads")
    file_path = os.path.join(installer_dir, filename)

    # 1. Hapus record dari database SQLite
    await delete_installer_meta(filename)

    # 2. Hapus file fisik jika ada di storage server
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Gagal menghapus file fisik: {str(e)}"
            )

    return {
        "status": "success",
        "message": f"Installer '{filename}' berhasil dihapus dari database dan server.",
    }