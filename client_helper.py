import sqlite3
import re

import json
import sqlite3
from datetime import datetime


def get_all_diagnostics() -> list[dict]:
    """Mengambil seluruh kolom client_diagnostics dan nama dari tabel users."""
    conn = sqlite3.connect("watchers.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    devices = []

    try:
        # Ganti 'users' ke 'clients' jika tabel perangkat Anda bernama clients
        cursor.execute("""
            SELECT
                d.*,
                c.name AS name
            FROM client_diagnostics d
            LEFT JOIN clients c ON d.client_id = c.id
            ORDER BY c.name ASC
        """)
        rows = cursor.fetchall()
        print(f"[+] get_all_diagnostics: {len(rows)} records fetched.", flush=True)

        for row in rows:
            item = dict(row)
            item["name"] = item.get("name") or item["client_id"]

            try:
                item["health"] = json.loads(item["health_json"]) if item.get("health_json") else None
            except (json.JSONDecodeError, TypeError):
                item["health"] = None

            try:
                item["storage"] = json.loads(item["storage_json"]) if item.get("storage_json") else []
            except (json.JSONDecodeError, TypeError):
                item["storage"] = []

            try:
                item["apps"] = json.loads(item["apps_json"]) if item.get("apps_json") else []
            except (json.JSONDecodeError, TypeError):
                item["apps"] = []

            # Hapus string JSON mentah agar objek lebih ringkas saat dikirim ke template
            item.pop("health_json", None)
            item.pop("storage_json", None)
            item.pop("apps_json", None)

            devices.append(item)
    except Exception as e:
        print(f"[!] Error get_all_diagnostics: {e}", flush=True)
    finally:
        conn.close()

    return devices

def upsert_client_and_diagnostics(
    device_id: str, hostname: str, diagnostics: dict | None = None
) -> dict:
    """
    Menyimpan client baru ke DB jika belum ada (ON CONFLICT DO NOTHING),
    serta menyimpan atau memperbarui data diagnostik klien (ON CONFLICT DO UPDATE).
    Mengembalikan informasi status lock dan nama client terkini.
    """
    conn = sqlite3.connect("watchers.db")
    conn.execute("PRAGMA foreign_keys = ON;")
    cursor = conn.cursor()
    try:
        # 1. Insert client baru jika belum ada; abaikan jika sudah terdaftar
        cursor.execute("""
            INSERT INTO clients (id, name, is_locked, message, password)
            VALUES (?, ?, 0, '', '')
            ON CONFLICT(id) DO NOTHING
        """, (device_id, hostname))  

        # 2. Insert atau Update data diagnostik jika dikirim oleh agent
        if isinstance(diagnostics, dict):
            health = diagnostics.get("health") or {}
            storage = diagnostics.get("storage") or []
            apps = diagnostics.get("apps")

            health_status = (
                health.get("status", "Sehat") if isinstance(health, dict) else "Sehat"
            )
            health_json = json.dumps(health, ensure_ascii=False)
            storage_json = json.dumps(storage, ensure_ascii=False)

            has_apps = isinstance(apps, list)
            apps_json = json.dumps(apps, ensure_ascii=False) if has_apps else None
            apps_count = len(apps) if has_apps else 0
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            cursor.execute("""
                INSERT INTO client_diagnostics (
                    client_id, health_status, health_json, storage_json, apps_json, apps_count, updated_at
                )
                VALUES (?, ?, ?, ?, COALESCE(?, '[]'), ?, ?)
                ON CONFLICT(client_id) DO UPDATE SET
                    health_status = excluded.health_status,
                    health_json = excluded.health_json,
                    storage_json = excluded.storage_json,
                    apps_json = CASE
                        WHEN ? IS NOT NULL THEN excluded.apps_json
                        ELSE client_diagnostics.apps_json
                    END,
                    apps_count = CASE
                        WHEN ? IS NOT NULL THEN excluded.apps_count
                        ELSE client_diagnostics.apps_count
                    END,
                    updated_at = excluded.updated_at
            """, (
                device_id,
                health_status,
                health_json,
                storage_json,
                apps_json,
                apps_count,
                now_str,
                apps_json,
                apps_json,
            ))

        conn.commit()

        # 3. Ambil status lock terkini (output return tetap sama)
        cursor.execute(
            "SELECT is_locked, message, password, name FROM clients WHERE id = ?",
            (device_id,),
        )
        row = cursor.fetchone()

        if row:
            return {
                "is_locked": bool(row[0]),
                "message": row[1] or "DIKUNCI OLEH GURU",
                "password": row[2] or "",
                "name": row[3] or hostname,
            }
    except Exception as e:
        print(f"[!] Error upsert_client_and_diagnostics: {e}")
    finally:
        conn.close()

    return {"is_locked": False, "message": "", "password": "", "name": hostname}

def update_clients_lock_status(device_ids: list[str], is_locked: bool, message: str = "", password: str = ""):
    """
    Memperbarui status lock (is_locked, message, password) secara batch
    untuk kumpulan device_id di tabel 'clients'.
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

async def delete_installer_meta(name: str) -> bool:
    """Menghapus metadata installer dari database berdasarkan nama."""
    conn = sqlite3.connect("watchers.db")
    cursor = conn.cursor()

    cursor.execute(
        """
        DELETE FROM agent_installers
        WHERE name = ?
    """,
        (name,),
    )

    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()

    # Mengembalikan True jika ada data yang terhapus, False jika nama tidak ditemukan
    return rows_affected > 0

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

    import main

    main.CURRENT_VERSION = row["version"] if row else "0.0.0"
    main.CURRENT_SHA256 = row["sha256"] if row else ""
    main.CURRENT_URL_DOWNLOAD = row["url"] if row else ""

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