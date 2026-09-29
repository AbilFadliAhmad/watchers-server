import sqlite3

# ================================================================
# HELPER DATABASE CLIENTS
# ================================================================
def upsert_client_and_get_status_and_name(device_id: str, hostname: str) -> dict:
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