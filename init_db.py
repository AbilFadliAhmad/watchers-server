# --- DATABASE SETUP (SQLite) ---
import sqlite3
from auth import hash_password

def init_db():
    # Pastikan nama file database konsisten (watchers.db)
    conn = sqlite3.connect("watchers.db")
    cursor = conn.cursor()

    # 1. Aktifkan fitur Foreign Key di SQLite
    cursor.execute("PRAGMA foreign_keys = ON;")

    # 2. Buat Tabel rooms
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        )
    """)

    # 3. Buat Room Awal ('teachers')
    cursor.execute("INSERT OR IGNORE INTO rooms (name) VALUES ('teachers')")

    # 4. Buat Tabel users dengan Foreign Key menunjuk ke rooms(name)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT CHECK(role IN ('dosen', 'direktur', 'developer')) NOT NULL,
            room TEXT NOT NULL DEFAULT 'teachers',
            FOREIGN KEY (room) REFERENCES rooms(name) ON DELETE RESTRICT ON UPDATE CASCADE
        )
    """)

    # 5. Buat Tabel stream_settings (Pengaturan Mode Grid & Fullscreen)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stream_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mode TEXT UNIQUE NOT NULL CHECK(mode IN ('grid', 'fullscreen')),
            quality INTEGER NOT NULL,
            scale TEXT NOT NULL,
            interval REAL NOT NULL
        )
    """)

    # 6. Tambahkan akun default awal jika database kosong
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        default_users = [
            ("developer", hash_password("123"), "developer", "teachers"),
            ("dosen", hash_password("123"), "dosen", "teachers"),
            ("direktur", hash_password("123"), "direktur", "teachers"),
        ]
        cursor.executemany(
            "INSERT INTO users (username, password_hash, role, room) VALUES (?, ?, ?, ?)",
            default_users,
        )

    # 7. Tambahkan konfigurasi default awal untuk 'grid' dan 'fullscreen'
    default_settings = [
        ("grid", 50, "640x360", 5.0),  # Grid: 5 detik/frame
        ("fullscreen", 70, "1280x720", 0.066),  # Fullscreen: ~15 FPS (1/15)
    ]
    cursor.executemany(
        """
        INSERT OR IGNORE INTO stream_settings (mode, quality, scale, interval)
        VALUES (?, ?, ?, ?)
        """,
        default_settings,
    )

    conn.commit()
    conn.close()