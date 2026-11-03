# --- DATABASE SETUP (SQLite) ---
import sqlite3
import uuid
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
    cursor.execute("INSERT OR IGNORE INTO rooms (id, name) VALUES (1, 'all')")

    # 2. Tabel roles
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        )
    """)
    cursor.execute("INSERT OR IGNORE INTO roles (id, name) VALUES (1, 'admin')")

    # 1. TABEL: users (Menggunakan UUIDv7 sebagai Primary Key)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role_id INTEGER NOT NULL DEFAULT 1,
            room_id INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT ON UPDATE CASCADE,
            FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT ON UPDATE CASCADE
        )
    """)

    # 4. Tabel stream_settings
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

    # 5. Tabel clients (Diperbarui)
    cursor.execute("""
            CREATE TABLE IF NOT EXISTS clients (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                is_locked INTEGER DEFAULT 0,
                message TEXT DEFAULT '',
                password TEXT DEFAULT ''
            )
        """)
    # Membuat Index untuk mempercepat query pencarian awalan (LIKE 'dm%')
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_clients_hostname ON clients(name)")

    # 6. Tabel agent_installers
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS agent_installers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            version TEXT NOT NULL,
            url TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 7. Tabel active_ota_config
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS active_ota_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            name TEXT NOT NULL,
            version TEXT NOT NULL,
            url TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 8. Data Akun Default (Menggunakan role_id=1 & room_id=1)
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        default_users = [
            (str(uuid.uuid4()), "direktur", hash_password("123"), 1, 1),
        ]
        cursor.executemany(
            "INSERT INTO users (id, username, password_hash, role_id, room_id) VALUES (?, ?, ?, ?, ?)",
            default_users,
        )

    # 9. Data Stream Settings Default
    default_settings = [
        ("grid", 50, 640, 360, 5.0),
        ("fullscreen", 70, 1280, 720, 1.0),
    ]
    cursor.executemany(
        """
        INSERT OR IGNORE INTO stream_settings (mode, quality, scale_width, scale_height, interval)
        VALUES (?, ?, ?, ?, ?)
        """,
        default_settings,
    )

    # 10. TABEL BARU: activity_logs (Tanpa hostname, index pada client_id)
    cursor.execute("""
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id TEXT NOT NULL,
                action_type TEXT NOT NULL CHECK(action_type IN ('message', 'lock', 'unlock', 'open_url', 'macro', 'shutdown', 'ota_update')),
                details TEXT DEFAULT '',
                executed_by TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
                FOREIGN KEY (executed_by) REFERENCES users(id) ON DELETE SET NULL
            )
        """)
    # Membuat Index pada client_id
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_client_id ON activity_logs(client_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_executed_by ON activity_logs(executed_by)")

    # 11. TABEL BARU: user_violations (Pencatatan Khusus Pelanggaran Siswa)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_violations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id TEXT NOT NULL,
            action_type TEXT NOT NULL,
            details TEXT DEFAULT '',
            executed_by TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
            FOREIGN KEY (executed_by) REFERENCES users(id) ON DELETE SET NULL
        )
    """)

    # Membuat Index pada client_id dan executed_by untuk mempercepat query log pelanggaran
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_violations_client_id ON user_violations(client_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_violations_executed_by ON user_violations(executed_by)")
    
    conn.commit()
    conn.close()