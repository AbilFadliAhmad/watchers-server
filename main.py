import asyncio
import time
from fastapi import FastAPI, File,Response, status, Request, HTTPException, UploadFile, Query
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import socketio
import os
import shutil
from auth import (router as auth_router)
from client_helper import get_active_installer_config, update_clients_lock_status, upsert_client_and_diagnostics, get_all_diagnostics, verify_client_password, save_chat_message, get_chat_history_by_client
from management import (router as management_router, get_management_data, fetch_stream_config_from_db, get_logs_data, record_activity_logs, fetch_domain_devices)
from auth_middleware import get_current_user
from typing import Optional
from init_db import init_db
from functools import wraps
from verify_uninstall import router as uninstall_router
import sqlite3

# Init DB
init_db()

# 0. INISIALISISAI VARIABEL GLOBAL UNTUK VERSI AGENT TERBARU
CURRENT_VERSION = "0.0.0"
CURRENT_SHA256 = ""
CURRENT_URL_DOWNLOAD = ""
get_active_installer_config()  # Memuat versi aktif terakhir dari database ke variabel global

# Mapping filter waktu ke ekspresi modifier SQLite
TIME_RANGE_MAP = {
    "1w": "-7 days",
    "2w": "-14 days",
    "1m": "-1 month",
    "3m": "-3 months",
    "6m": "-6 months",
    "1y": "-1 year"
}

UPLOAD_DIR = "downloads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 1. Inisialisasi Socket.IO AsyncServer (Engine ASGI)
sio = socketio.AsyncServer(
    async_mode="asgi", cors_allowed_origins="*", max_http_buffer_size=10000000
)

# 2. Inisialisasi FastAPI App
app = FastAPI(title="Watchers Server")
app.include_router(auth_router) # daftarkan rute auth.py
app.include_router(management_router) # daftarkan rute management.py
app.include_router(uninstall_router)  # daftarkan rute verify_uninstall.py

app.mount("/downloads", StaticFiles(directory=UPLOAD_DIR), name="downloads")
app.mount('/static', StaticFiles(directory='static'), name='static')
templates = Jinja2Templates(directory="templates")

STREAM_CONFIG = fetch_stream_config_from_db()
print(f"[*] STREAM_CONFIG dimuat dari DB: {STREAM_CONFIG}")

# In-memory State Management
# Format: { device_id: {"sid": str, "hostname": str, "telemetry": dict, "mode": str} }
connected_students = {}
teacher_sids = set()
active_focus_viewers = {}

# --- HELPER DYNAMIC CONFIG BROADCAST (DIGUNAKAN DI FILE MANAGEMENT) ---
async def broadcast_stream_config():
    """Fungsi pembantu untuk reload config dari DB ke RAM dan broadcast ke seluruh client."""
    global STREAM_CONFIG
    STREAM_CONFIG = fetch_stream_config_from_db()
    await sio.emit("update_config", STREAM_CONFIG)
    print(f"[*] STREAM_CONFIG dibroadcast ulang: {STREAM_CONFIG}")

# HELPER FUNCTION FOR GET DOMAIN
def _get_current_domain(request: Request) -> str:
    # 1. Prioritaskan X-Forwarded-Host (jika di balik Nginx / Cloudflare Tunnel)
    forwarded_host = request.headers.get("x-forwarded-host", "").strip()
    if forwarded_host:
        # Ambil host pertama jika dipisahkan koma, lalu buang nomor port jika ada
        return forwarded_host.split(",")[0].strip().split(":")[0].lower()

    # 2. Fallback ke header Host standar
    host = request.headers.get("host", "").strip()
    if host:
        return host.split(":")[0].lower()

    # 3. Fallback ke base_url
    return (request.base_url.hostname or "").lower()

# --- SOCKET.IO EVENT HANDLERS ---
@sio.event
async def connect(sid, environ):
    print(f"[+] Client tersambung: {sid}")

@sio.event
async def disconnect(sid):
    # 1. Cari siswa berdasarkan sid di dalam nested dictionary
    found_device_id = None
    for device_id, student_info in connected_students.items():
        if student_info.get('sid') == sid:
            found_device_id = device_id
            break  # Keluar dari loop jika sudah ketemu

    # 2. Jika ditemukan, lakukan pop menggunakan key device_id tersebut
    if found_device_id:
        student = connected_students.pop(found_device_id)
        print(f"[-] Siswa terputus: {student.get('name')}")

        # Beritahu semua dashboard guru bahwa siswa ini offline
        await sio.emit("student_disconnected", student, room="all")

    elif sid in teacher_sids:
        to_remove = []  # untuk hapus fullscreen
        for target_sid, viewers in active_focus_viewers.items():
            if sid in viewers:
                viewers.remove(sid)
                # Jika tidak ada penonton tersisa di PC tersebut
                if len(viewers) == 0:
                    to_remove.append(target_sid)

                    await sio.emit(
                        "command",
                        {"action": "set_mode", "mode": "grid"},
                        to=target_sid,
                    )

        # Menghapus key dictionary secara aman setelah iterasi selesai
        for target_sid in to_remove:
            del active_focus_viewers[target_sid]

        teacher_sids.remove(sid)
        print(f"[-] Guru terputus: {sid}")

@sio.on("start_focus_view") # type: ignore
async def on_start_focus(sid, data):
    device_id = data.get("device_id")
    target_sid = connected_students.get(device_id, {}).get("sid")

    if not device_id or not target_sid:
        return

    if target_sid not in active_focus_viewers:
        active_focus_viewers[target_sid] = set()

    active_focus_viewers[target_sid].add(sid)

    # Perintahkan PC siswa untuk masuk mode 15 FPS (focus)
    await sio.emit(
        "command", {"action": "set_mode", "mode": "focus"}, to=target_sid
    )

@sio.on("stop_focus_view") # type: ignore
async def on_stop_focus(sid, data):
    target_sid = data.get("target_sid")
    if target_sid and target_sid in active_focus_viewers:
        active_focus_viewers[target_sid].discard(sid)

        # Jika sudah tidak ada guru lain yang menonton PC ini
        if len(active_focus_viewers[target_sid]) == 0:
            del active_focus_viewers[target_sid]
            await sio.emit(
                "command",
                {"action": "set_mode", "mode": "grid"},
                to=target_sid,
            )

@sio.on("register_teacher") # type: ignore
async def on_register_teacher(sid, data):
    """Mendaftarkan koneksi browser guru ke room 'all'."""
    user_data = (data or {}).get("user") or {}
    room_name = user_data.get("room")
    role = user_data.get("role")

    if room_name:
        await sio.enter_room(sid, room_name)

    if role == "admin":
        await sio.enter_room(sid, "admins")

    await sio.save_session(sid, {"room": room_name, "role": role})
    teacher_sids.add(sid)

@sio.on("register_student") # type: ignore
async def on_register_student(sid, data):
    hostname = data.get("hostname", "Unknown-PC")
    device_id = data.get("device_id", hostname) # Fallback ke hostname jika device_id kosong
    diagnostics = data.get("diagnostics")

    # 2. Registrasi / Upsert ke Database SQLite Server & Ambil Status Lock
    device_status = upsert_client_and_diagnostics(device_id, hostname, diagnostics)
    name = device_status.get("name", hostname)
    student_room = name.split("-")[0].lower()

    # 3. Simpan informasi PC Siswa ke in-memory state
    connected_students[device_id] = {
        "sid": sid,
        "name": name,
        "device_id": device_id,
        "room": student_room,
        "telemetry": {"cpu": 0, "ram": 0, "open_windows": []},
        "mode": "grid",
    }

    target_rooms = ["all", student_room]

    # sio enter parameter kedua harus berupa string tunggal tapi sio emit roomnya bisa banyak array jadi saya sederhanakan saja menjadi menggunakan cara pertama agar lebih ringas
    for room in target_rooms:
        await sio.enter_room(sid, room)
        await sio.emit('student_conencted', name, room=room)

    # PERBAIKAN: Kirimkan konfigurasi stream terbaru langsung ke PC Siswa saat baru connect
    await sio.emit("update_config", STREAM_CONFIG, to=sid)

    # 5. SINKRONISASI OTOMATIS: Jika di server terdeteksi TERKUNCI, kunci PC seketika
    if device_status["is_locked"]:
        print(f"[!] Client {hostname} ({device_id}) terdeteksi TERKUNCI di database server. Mengirim perintah lock...", flush=True)
        await sio.emit(
            "command",
            {
                "action": "lock",
                "message": device_status["message"],
            },
            to=sid
        )

@sio.on("student_frame")  # type: ignore
async def on_student_frame(sid, data):
    """Menerima screenshot layar & telemetri dari PC siswa, lalu menyalurkannya ke guru."""
    device_id = data.get("device_id", sid)
    telemetry = data.get("telemetry") or {}
    agent_version = telemetry.get("agent_version", "0.0.0")
    hostname = connected_students.get(device_id, {}).get("hostname", "Unknown-PC")
    # print(CURRENT_VERSION, agent_version)

    # --- LOGIKA PERBANDINGAN VERSI ---
    if CURRENT_VERSION != "0.0.0" and agent_version != CURRENT_VERSION:
        update_payload = {
            "latest_version": CURRENT_VERSION,
            "client_password": "admin123",  # Password default untuk update agent
            "sha256": CURRENT_SHA256,
            "download_url": CURRENT_URL_DOWNLOAD,
        }

        print(f"[DEBUG] payload update dikirim ke {device_id}: {update_payload}", flush=True)

        # Kirim sinyal update HANYA ke socket client ini (sid)
        await sio.emit("trigger_update", update_payload, to=sid)

    # Data disalurkan HANYA ke client yang berada di room 'all'
    payload = {
        "device_id": device_id,
        "hostname": connected_students.get(device_id, {}).get(
            "name", hostname
        ),
        "telemetry": telemetry,
        "image": data.get("image"),  # Bytes / WebP Frame
    }
    print(f"[DEBUG] payload frame dikirim ke guru: {connected_students}", flush=True)

    target_rooms = [
        "all",
        str(payload.get("hostname")).split("-")[0].lower(),
    ]
    
    await sio.emit("update_student_card", payload, room=target_rooms)

@sio.on("directory_audit_response") # type: ignore
async def on_directory_audit_response(sid, data):
    if isinstance(data, dict):
        data["sid"] = sid
    await sio.emit("directory_audit_result", data, room='admins')

@sio.on("student_chat_message") # type: ignore
async def on_student_chat_message(sid, data):
    """Menerima laporan/pesan SMS dari PC siswa -> simpan ke server -> teruskan ke admin."""
    client_id = (data.get("device_id") or "").strip()
    hostname = (data.get("hostname") or "Siswa").strip()
    text = (data.get("message") or "").strip()

    if not client_id or not text:
        return {"ok": False}

    saved = await asyncio.to_thread(
        save_chat_message,
        client_id=client_id,
        sender_role="student",
        sender_name=hostname,
        message=text,
        is_read=0,
    )
    saved["sid"] = sid

    # Broadcast ke seluruh admin/guru yang sedang membuka dashboard
    await sio.emit("new_student_chat", saved, room="admins")
    # Konfirmasi balik ke agent siswa agar status pesan berubah menjadi terkirim
    return {"ok": True, "message_data": saved}


@sio.on("admin_chat_reply") # type: ignore
async def on_admin_chat_reply(sid, data):
    """Menerima balasan dari dashboard admin -> simpan ke server -> kirim ke PC siswa."""
    client_id = (data.get("client_id") or "").strip()
    admin_name = (data.get("admin_name") or "Guru / Admin").strip()
    text = (data.get("message") or "").strip()

    if not client_id or not text:
        return {"ok": False}

    saved = await asyncio.to_thread(
        save_chat_message,
        client_id=client_id,
        sender_role="admin",
        sender_name=admin_name,
        message=text,
        is_read=1,
    )

    target_sid = connected_students.get(client_id, {}).get("sid")
    if target_sid:
        await sio.emit("chat_reply", saved, to=target_sid)

    # 2. Sinkronkan juga ke tab admin lain jika ada lebih dari satu guru login
    await sio.emit("new_student_chat", saved, room="admins")
    return {"ok": True, "message_data": saved}


@sio.on("request_chat_history") # type: ignore
async def on_request_chat_history(sid, data):
    client_id = (data.get("client_id") or data.get("device_id") or "").strip()
    requester = (data.get("role") or "admin").strip()
    if not client_id:
        return {"ok": False, "messages": []}

    def _fetch_and_mark():
        conn = sqlite3.connect('watchers.db')
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        try:
            if requester == "admin":
                cur.execute(
                    "UPDATE chat_messages SET is_read = 1 WHERE client_id = ? AND sender_role = 'student' AND is_read = 0",
                    (client_id,),
                )
            else:
                cur.execute(
                    "UPDATE chat_messages SET is_read = 1 WHERE client_id = ? AND sender_role = 'admin' AND is_read = 0",
                    (client_id,),
                )
            conn.commit()

            cur.execute(
                """
                SELECT id, client_id, sender_role, sender_name, message, is_read, created_at
                FROM chat_messages
                WHERE client_id = ?
                ORDER BY id DESC
                LIMIT 50
                """,
                (client_id,),
            )
            rows = [dict(r) for r in cur.fetchall()]
            rows.reverse()
            return rows
        finally:
            cur.close()
            conn.close()

    history = await asyncio.to_thread(_fetch_and_mark)

    if requester == "student":
        await sio.emit("chat_messages_read", {"client_id": client_id}, room="admins")

    return {"ok": True, "client_id": client_id, "messages": history}

@sio.on("get_chat_overview") # type: ignore
async def on_get_chat_overview(sid, data=None):
    """Mengambil 10 pesan terakhir per client_id dan menghitung is_read kosong/false pada 10 pesan tersebut."""
    def _query_overview():
        conn = sqlite3.connect('watchers.db')
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        try:
            cur.execute("""
                WITH recent_10 AS (
                    SELECT
                        id,
                        client_id,
                        sender_role,
                        sender_name,
                        message,
                        is_read,
                        created_at,
                        ROW_NUMBER() OVER (
                            PARTITION BY client_id
                            ORDER BY id DESC
                        ) AS rn
                    FROM chat_messages
                )
                SELECT
                    r.client_id,
                    r.id AS last_id,
                    r.sender_role,
                    r.sender_name,
                    r.message,
                    r.created_at,
                    (
                        SELECT COUNT(*)
                        FROM recent_10 sub
                        WHERE sub.client_id = r.client_id
                          AND sub.rn <= 10
                          AND sub.sender_role = 'student'
                          AND (sub.is_read IS NULL OR sub.is_read = 0)
                    ) AS unread_in_last_10
                FROM recent_10 r
                WHERE r.rn = 1
                ORDER BY r.id DESC
            """)
            return [dict(r) for r in cur.fetchall()]
        finally:
            cur.close()
            conn.close()

    items = await asyncio.to_thread(_query_overview)
    return {"ok": True, "items": items}

@sio.on("send_command")  # type: ignore
async def on_send_command(_, data):
    """
    Menerima perintah remot dari Web Dashboard Guru dan meneruskannya ke Client Siswa.
    Payload: {"device_ids": ["DEVICE_ID_1", ...], "executed_by": "USER_ID", "command": {"action": "message", ...}}
    """
    command = data.get("command", {})
    action = command.get("action")
    is_warning = command.get("is_warning", False)
    log_details = command.get("log_details", "Tidak ada catatan")
    executed_by = data.get("executed_by")

    # 1. Normalisasi target menjadi array device_ids
    raw_targets = data.get("device_ids") or []
    if isinstance(raw_targets, list):
        target_device_ids = [dev_id for dev_id in raw_targets if dev_id]
    else:
        target_device_ids = []

    if not target_device_ids:
        return

    # 2. Ubah array device_id menjadi kumpulan sid aktif dari connected_students
    target_sids = [
        connected_students[dev_id]["sid"]
        for dev_id in target_device_ids
        if dev_id in connected_students and connected_students[dev_id].get("sid")
    ]

    # 3. UPDATE DATABASE LOGIC (Status Kunci Layar secara batch)
    if action in ["lock", "unlock"]:
        is_locked = (action == "lock")
        msg = command.get("message", "DIKUNCI OLEH GURU") if is_locked else ""
        pwd = command.get("password", "") if is_locked else ""

        update_clients_lock_status(
            device_ids=target_device_ids,
            is_locked=is_locked,
            message=msg,
            password=pwd
        )

    # 4. RECORD LOG & PELANGGARAN (Insert many / batch)
    record_activity_logs(
        client_ids=target_device_ids,
        action_type=action,
        details=log_details,
        executed_by=executed_by,
        is_warning=is_warning
    )

    # 5. KIRIM PERINTAH LEWAT WEBSOCKET KE SETIAP SID TERKAIT
    for target_sid in target_sids:
        await sio.emit("command", command, to=target_sid)

@sio.on("request_all_diagnostics")  # type: ignore
async def on_request_all_diagnostics(sid, data=None):
    _diag_timers: dict[str, float] = {}
    target_id = data.get("device_id", "all") if isinstance(data, dict) else "all"
    include_apps = data.get("include_apps", True) if isinstance(data, dict) else True

    now = time.perf_counter()

    if target_id == "all":
        for dev_id in connected_students.keys():
            _diag_timers[dev_id] = now
        await sio.emit("request_pc_diagnostics", {"include_apps": include_apps}, room="all")
    else:
        student = connected_students.get(target_id)
        if student and student.get("sid"):
            _diag_timers[target_id] = now
            await sio.emit("request_pc_diagnostics", {"include_apps": include_apps}, to=student["sid"])

@sio.on("report_pc_diagnostics")  # type: ignore
async def on_report_pc_diagnostics(sid, data):
    _diag_timers: dict[str, float] = {}
    t_recv = time.perf_counter()

    if not isinstance(data, dict):
        return

    device_id = data.get("device_id")
    if not device_id:
        for dev_id, info in connected_students.items():
            if info.get("sid") == sid:
                device_id = dev_id
                break
    if not device_id:
        return

    student = connected_students.get(device_id, {})
    hostname = student.get("name", device_id)

    await asyncio.to_thread(upsert_client_and_diagnostics, device_id, hostname, data)

    all_devices = await asyncio.to_thread(get_all_diagnostics)
    updated_device = next((d for d in all_devices if d["client_id"] == device_id), None)

    if updated_device:
        await sio.emit("pc_diagnostics_updated", updated_device)

    # Hitung & tampilkan kecepatan di terminal server
    t_done = time.perf_counter()
    t_start = _diag_timers.pop(device_id, None)
    db_ms = round((t_done - t_recv) * 1000, 2)

    if t_start is not None:
        rtt_ms = round((t_recv - t_start) * 1000, 2)
        total_ms = round((t_done - t_start) * 1000, 2)
        print(
            f"[DIAG SPEED] {hostname} ({device_id}) | "
            f"Socket+Scan RTT: {rtt_ms} ms | DB+Broadcast: {db_ms} ms | Total: {total_ms} ms",
            flush=True,
        )
    else:
        # Terjadi saat PC baru pertama kali connect (register_student / auto-report)
        print(
            f"[DIAG SPEED] {hostname} ({device_id}) | "
            f"Initial Report | DB+Broadcast: {db_ms} ms",
            flush=True,
        )

@sio.on("verify_unlock_password") # type: ignore
async def on_verify_unlock_password(sid, data):
    """
    Menerima dan memverifikasi kata sandi yang diinputkan dari LockScreenWidget client.
    Payload: {"device_id": "GUID_CLIENT", "password": "INPUT_PASSWORD"}
    """
    device_id = data.get("device_id")
    input_password = data.get("password", "").strip()

    if not device_id:
        return {"success": False, "message": "Device ID tidak terdeteksi."}

    await verify_client_password(input_password=input_password, device_id=device_id, sid=sid, sio=sio)

# --- FASTAPI DECORATOR ---
def _copy_set_cookies(src_response: Response, target_response):
    """Menyalin header set-cookie (misal saat refresh token) ke Response/TemplateResponse."""
    if src_response is not None and hasattr(target_response, "headers"):
        for key, value in src_response.headers.items():
            if key.lower() == "set-cookie":
                target_response.headers.append("set-cookie", value)
    return target_response


def guest_only(redirect_to: str = "/control"):
    """
    Untuk halaman publik/tamu (/, /landing, /login):
    Jika user sudah login -> redirect ke /control.
    Jika belum login (401) -> lanjut tampilkan halaman.
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            request: Request = kwargs.get("request")
            response: Response = kwargs.get("response") or Response()

            try:
                user = await get_current_user(request, response)
                if user:
                    res = RedirectResponse(url=redirect_to, status_code=status.HTTP_302_FOUND)
                    return _copy_set_cookies(response, res)
            except HTTPException:
                pass

            result = await func(*args, **kwargs)
            return _copy_set_cookies(response, result)

        return wrapper
    return decorator

def login_required(login_url: str = "/login"):
    """
    Untuk halaman terproteksi (/control, /logs, /health, dll.):
    Jika belum login (401) -> otomatis redirect ke login_url.
    Jika sudah login -> menyimpan objek user ke `request.state.user` dan menyalin set-cookie.
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            request: Request = kwargs.get("request")
            response: Response = kwargs.get("response") or Response()

            try:
                user = await get_current_user(request, response)
                if not user:
                    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
                request.state.user = user
            except HTTPException as e:
                if e.status_code == status.HTTP_401_UNAUTHORIZED:
                    return RedirectResponse(url=login_url, status_code=status.HTTP_302_FOUND)
                raise

            result = await func(*args, **kwargs)
            return _copy_set_cookies(response, result)

        return wrapper
    return decorator

# --- FASTAPI HTTP ROUTES ---
@app.get("/")
@guest_only("/control")
async def get_home(request: Request, response: Response):
    """Menyajikan halaman utama."""
    return templates.TemplateResponse(request=request, name="index.html")


@app.get("/landing")
@guest_only("/control")
async def get_landing(request: Request, response: Response):
    """Menyajikan halaman landing."""
    return templates.TemplateResponse(request=request, name="landing.html")

@app.get("/license")
@login_required("/login")
async def get_license(request: Request, response: Response):
    domain = _get_current_domain(request)
    domain_data = await fetch_domain_devices(domain)
    devices = domain_data["devices"]

    return templates.TemplateResponse(
        request=request,
        name="license.html",
        context={
            "current_domain": domain,
            "is_bound": domain_data["bound"],
            "credential_key": domain_data["credential_key"],
            "tier": domain_data["tier"],
            "max_devices": domain_data["max_devices"],
            "devices": devices,
            "expired_at": domain_data["expired_at"],
        },
    )

@app.get("/control")
@login_required("/")
async def get_control(request: Request, response: Response):
    """Menyajikan halaman Web Dashboard dengan data manajemen terpadu."""
    user = request.state.user
    mgmt_data = await get_management_data(user.get("role", ""))
    print(f"[*] Data manajemen untuk groups {mgmt_data['groups']} ", flush=True)

    return templates.TemplateResponse(
        request=request,
        name="control.html",
        context={
            "user": user,
            "users": mgmt_data["users"],
            "rooms": mgmt_data["rooms"],
            "groups": mgmt_data["groups"],
            "clients": mgmt_data["clients"],
            "roles": mgmt_data["roles"],
            "installers": mgmt_data["installers"],
            "stream_config": STREAM_CONFIG,
        },
    )

@app.get("/login", response_class=HTMLResponse)
@guest_only("/control")
async def get_login_page(request: Request, response: Response):
    """Menyajikan halaman login. Jika pengguna sudah login, redirect ke /control."""
    return templates.TemplateResponse(request=request, name="login.html")

@app.get("/logs", response_class=HTMLResponse)
@login_required("/login")
async def get_logs_page(
    request: Request,
    response: Response,
    action: Optional[str] = Query(None),
    time_range: Optional[str] = Query("1w"),
):
    """Menyajikan halaman HTML Log & Pelanggaran."""
    user = request.state.user
    selected_time = time_range if time_range in TIME_RANGE_MAP else "1w"

    data = await get_logs_data(
        current_user=user,
        action=action,
        time_range=selected_time,
    )

    return templates.TemplateResponse(
        request=request,
        name="logs.html",
        context={
            "user": user,
            "violations_summary": data["violations_summary"],
            "logs": data["logs"],
            "selected_action": action or "",
            "selected_time_range": selected_time,
        },
    )

@app.get("/health", response_class=HTMLResponse)
@login_required("/login")
async def devices_page(request: Request):
    user = request.state.user
    devices = await asyncio.to_thread(get_all_diagnostics)
    print(f"[*] Data devices untuk {user.get('username')}: {devices}", flush=True)

    return templates.TemplateResponse(
        request=request,
        name="health.html",
        context={
            "request": request,
            "user": user,
            "devices": devices,
        },
    )

@app.post("/upload-update")
async def upload_ota_update(request: Request, file: UploadFile = File(...)):
    # Validasi ekstensi file
    if not str(file.filename).endswith(".exe"):
        raise HTTPException(
            status_code=400, detail="Hanya file .exe yang diizinkan."
        )

    file_path = os.path.join(UPLOAD_DIR, file.filename) # type: ignore

    # Simpan file ke disk menggunakan buffer chunking
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan file: {e}")

    # Susun URL publik dinamis (contoh: http://localhost:8000/downloads/WatchersAgent.exe)
    public_url = f"{request.base_url}downloads/{file.filename}"

    return {
        "status": "success",
        "filename": file.filename,
        "url": public_url,
    }

# Fungsi helper untuk menambahkan query parameter versioning agar javascript tidak di-cache oleh browser
def static_v(path: str) -> str:
    file_path = os.path.join("static", path)
    if os.path.exists(file_path):
        mtime = int(os.path.getmtime(file_path))
        return f"/static/{path}?v={mtime}"
    return f"/static/{path}"


# Daftarkan fungsi ke Jinja2 globals
templates.env.globals["static_v"] = static_v

# Integrating Socket.IO ASGI App ke FastAPI
socket_app = socketio.ASGIApp(sio, app)