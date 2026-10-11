import sqlite3
import re

def upsert_client_and_get_info_device(device_id: str, hostname: str) -> dict:
    """
    Menyimpan client baru ke DB jika belum ada (nama = hostname).
    Jika sudah ada, perbarui namanya dan ambil status lock saat ini.
    """
    conn = sqlite3.connect("watchers.db")
    cursor = conn.cursor()
    try:
        # Insert client baru jika belum ada, atau update nama jika hostname berubah
        cursor.execute("""
            INSERT INTO clients (id, name, is_locked, message, password)
            VALUES (?, ?, 0, '', '')
            ON CONFLICT(id) DO NOTHING
        """, (device_id, hostname))
        conn.commit()

        # Ambil status lock terkini
        cursor.execute("SELECT is_locked, message, password, name FROM clients WHERE id = ?", (device_id,))
        row = cursor.fetchone()
        
        if row:
            return {
                "is_locked": bool(row[0]),
                "message": row[1] or "DIKUNCI OLEH GURU",
                "password": row[2] or "",
                "name": row[3] or hostname
            }
    except Exception as e:
        print(f"[!] Error upsert_client_and_get_status: {e}")
    finally:
        conn.close()

    return {"is_locked": False, "message": "", "password": "", "name": hostname}

def update_clients_lock_status(device_ids: list, is_locked: bool, message: str = "", password: str = ""):
    """
    Memperbarui status lock (is_locked, message, password) untuk satu 
    atau beberapa device_id di tabel 'clients' database SQLite server.
    """
    if not device_ids:
        return

    conn = sqlite3.connect("watchers.db")
    cursor = conn.cursor()
    try:
        records = [
            (1 if is_locked else 0, message, password, dev_id)
            for dev_id in device_ids
        ]
        cursor.executemany("""
            UPDATE clients
            SET is_locked = ?, message = ?, password = ?
            WHERE id = ?
        """, records)
        conn.commit()
    except Exception as e:
        print(f"[!] Error update_clients_lock_status: {e}", flush=True)
        conn.rollback()
    finally:
        conn.close()

async def verify_client_password(input_password: str, device_id: str, sid: str, sio) -> dict: 

    conn = sqlite3.connect("watchers.db")
    cursor = conn.cursor()
    try:
        # Ambil password asli dari tabel clients
        cursor.execute("SELECT password, is_locked FROM clients WHERE id = ?", (device_id,))
        row = cursor.fetchone()

        if not row:
            return {"success": False, "message": "Perangkat tidak terdaftar di database server."}

        db_password = row[0] or ""

        # Verifikasi Kata Sandi
        if input_password == db_password:
            # 1. Update status di SQLite server menjadi tidak terkunci
            update_clients_lock_status([device_id], is_locked=False)

            # 2. Perintahkan Client untuk menutup Lock Screen
            await sio.emit("command", {"action": "unlock"}, to=sid) 

            return {"success": True, "message": "Kata sandi cocok."}
        else:
            return {"success": False, "message": "Kata sandi salah!"}

    except Exception as e:
        print(f"[!] Error pada verify_unlock_password: {e}", flush=True)
        return {"success": False, "message": "Terjadi kesalahan internal server."}
    finally:
        conn.close()

async def get_all_installers():
    """Mengambil semua daftar installer dari database untuk direspon ke endpoint API."""

    # Regex ketat untuk pola: WatchersAgent-vX.Y.Z-ARCH.exe
    WATCHER_FILENAME_REGEX = re.compile(
        r"^WatchersAgent-v\d+\.\d+\.\d+-(x64|x86|arm64)\.exe$", re.IGNORECASE
    )

    conn = sqlite3.connect("watchers.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute(
        "SELECT name, version, url, sha256 FROM agent_installers ORDER BY"
        " id DESC"
    )
    rows = cursor.fetchall()
    conn.close()

    # Memfilter hasil query berdasarkan pola nama yang sesuai
    return [
        dict(row) for row in rows if WATCHER_FILENAME_REGEX.match(row["name"])
    ]

async def save_installer_meta(name: str, version: str, url: str, sha256: str):
    """Menyimpan atau memperbarui metadata installer di database."""
    conn = sqlite3.connect("watchers.db")
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO agent_installers (name, version, url, sha256)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
            version = excluded.version,
            url = excluded.url,
            sha256 = excluded.sha256,
            created_at = CURRENT_TIMESTAMP
    """,
        (name, version, url, sha256),
    )

    conn.commit()
    conn.close()

def set_active_installer_config(
    name: str, version: str, url: str, sha256: str
):
    """Menyimpan atau menimpa satu-satunya riwayat versi aktif di database."""
    conn = sqlite3.connect("watchers.db")
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO active_ota_config (id, name, version, url, sha256, updated_at)
        VALUES (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            version = excluded.version,
            url = excluded.url,
            sha256 = excluded.sha256,
            updated_at = CURRENT_TIMESTAMP
    """,
        (name, version, url, sha256),
    )

    conn.commit()
    conn.close()

def get_active_installer_config():
    """Mengambil riwayat versi aktif terakhir."""
    conn = sqlite3.connect("watchers.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute(
        "SELECT name, version, url, sha256, updated_at FROM active_ota_config"
        " WHERE id = 1"
    )
    row = cursor.fetchone()
    conn.close()

    from main import CURRENT_VERSION, CURRENT_SHA256, CURRENT_URL_DOWNLOAD

    CURRENT_VERSION = row["version"] if row else "0.0.0"
    CURRENT_SHA256 = row["sha256"] if row else ""
    CURRENT_URL_DOWNLOAD = row["url"] if row else ""

    return dict(row) if row else None

def parse_version(version_str: str) -> tuple:
    """Mengonversi string versi '1.3.0' menjadi tuple angka (1, 3, 0) untuk perbandingan akurat."""
    try:
        # Bersihkan karakter 'v' jika ada (contoh: 'v1.3.0' -> '1.3.0')
        clean_str = version_str.lower().replace("v", "").strip()
        return tuple(map(int, clean_str.split(".")))
    except Exception:
        return (0, 0, 0)

def parse_version_from_filename(filename: str) -> str:
    """Mengekstrak versi dari nama file (Contoh: WatchersAgent-v1.3.0-x64.exe -> 1.3.0)."""
    match = re.search(r"v?(\d+\.\d+\.\d+)", filename)
    if match:
        return match.group(1)
    return "1.0.0"