# --- DATABASE SETUP (SQLite) ---
import sqlite3
from auth import hash_password

# --- DATABASE SETUP (SQLite) ---
import sqlite3
from auth import hash_password

def init_db():
    conn = sqlite3.connect("watchers.db")
    cursor = conn.cursor()

    cursor.execute("PRAGMA foreign_keys = ON;")

    # 1. Tabel rooms
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        )
    """)
    cursor.execute("INSERT OR IGNORE INTO rooms (name) VALUES ('teachers')")

    # 2. Tabel users
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

    # 3. Tabel stream_settings
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stream_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mode TEXT UNIQUE NOT NULL CHECK(mode IN ('grid', 'fullscreen')),
            quality INTEGER NOT NULL,
            scale_width INTEGER NOT NULL,
            scale_height INTEGER NOT NULL,
            interval REAL NOT NULL
        )
    """)

    # 4. TABEL BARU: clients (Menyimpan Perangkat Unik & Status Lock)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS clients (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            is_locked INTEGER DEFAULT 0,
            message TEXT DEFAULT '',
            password TEXT DEFAULT ''
        )
    """)

    # 5. Data Akun Default
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

    # 6. Data Stream Settings Default (5 Kolom)
    default_settings = [
        ("grid", 50, 640, 360, 5.0),          # Grid: 5 detik/frame
        ("fullscreen", 70, 1280, 720, 0.066),  # Fullscreen: ~15 FPS
    ]
    cursor.executemany(
        """
        INSERT OR IGNORE INTO stream_settings (mode, quality, scale_width, scale_height, interval)
        VALUES (?, ?, ?, ?, ?)
        """,
        default_settings,
    )

    conn.commit()
    conn.close()