import sqlite3
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel, Field, main
from auth import hash_password
from auth_middleware import get_current_user

router = APIRouter(prefix="/api", tags=["Management"])
DB_NAME = "watchers.db"

# --- HELPER: GET ALL ROOMS & USERS ---
async def get_all_rooms():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM rooms ORDER BY id ASC")
    rooms = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"status": "success", "data": rooms}

async def get_all_users():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username, role, room FROM users ORDER BY id ASC"
    )
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"status": "success", "data": users}

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


# --- ENDPOINT 1: REGISTER ROOM BARU ---
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


# --- ENDPOINT 2: REGISTER USER BARU ---
@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user(user_data: UserCreateSchema):
    role = user_data.role.strip().lower()
    room = user_data.room.strip().lower() if user_data.room else "teachers"

    # Validasi role yang diizinkan
    valid_roles = ["dosen", "direktur", "developer"]
    if role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role tidak valid. Pilihan role yang tersedia: {', '.join(valid_roles)}",
        )

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

    # 2. Cek apakah room target ada di tabel rooms
    cursor.execute("SELECT id FROM rooms WHERE name = ?", (room,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Room '{room}' tidak ditemukan. Buat room terlebih dahulu.",
        )

    # 3. Hash password dan simpan user baru
    hashed_pwd = hash_password(user_data.password)
    cursor.execute(
        "INSERT INTO users (username, password_hash, role, room) VALUES (?, ?, ?, ?)",
        (user_data.username, hashed_pwd, role, room),
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
            "role": role,
            "room": room,
        },
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

# --- PYDANTIC UPDATE SCHEMAS ---
class RoomUpdateSchema(BaseModel):
    name: str = Field(..., min_length=2, example="lab_komputer_2")
class UserUpdateSchema(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None  # Kosongkan jika tidak ingin mengubah password
    role: Optional[str] = None  # dosen, direktur, developer
    room: Optional[str] = None

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


# --- ENDPOINT 6: EDIT USER ---
@router.put("/users/{user_id}", status_code=status.HTTP_200_OK)
async def update_user(user_id: int, user_data: UserUpdateSchema):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")

    # Cek apakah user ada
    cursor.execute("SELECT username, room FROM users WHERE id = ?", (user_id,))
    existing_user = cursor.fetchone()
    if not existing_user:
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

    # Update Role
    if user_data.role:
        role = user_data.role.strip().lower()
        if role not in ["dosen", "direktur", "developer"]:
            conn.close()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role tidak valid.",
            )
        updates.append("role = ?")
        params.append(role)

    # Update Room
    if user_data.room:
        room = user_data.room.strip().lower()
        cursor.execute("SELECT id FROM rooms WHERE name = ?", (room,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Room '{room}' tidak ditemukan.",
            )
        updates.append("room = ?")
        params.append(room)

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
        print(f"[DEBUG] Updating client name in DB: device_id={device_id}, new_name={new_name}")
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
