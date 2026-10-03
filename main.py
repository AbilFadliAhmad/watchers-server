from fastapi import FastAPI, File,Response, status, Request, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import socketio
import os
import shutil
from auth import (router as auth_router)
from client_helper import update_clients_lock_status, upsert_client_and_get_status_and_name, verify_client_password
from management import (router as management_router, get_all_users, get_all_rooms, fetch_stream_config_from_db)
from auth_middleware import get_current_user
from init_db import init_db

# 1. Inisialisasi Socket.IO AsyncServer (Engine ASGI)
sio = socketio.AsyncServer(
    async_mode="asgi", cors_allowed_origins="*", max_http_buffer_size=10000000
)

# 2. Inisialisasi FastAPI App
app = FastAPI(title="Watchers Server")
app.include_router(auth_router) # daftarkan rute auth.py
app.include_router(management_router) # daftarkan rute management.py

app.mount('/static', StaticFiles(directory='static'), name='static')
templates = Jinja2Templates(directory="templates")
UPLOAD_DIR = "downloads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Init DB
init_db()
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
        print(f'murid Mas : {student}')
        print(f"[-] Siswa terputus: {student.get('name')}")

        # Beritahu semua dashboard guru bahwa siswa ini offline
        await sio.emit("student_disconnected", student, room="teachers")

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
    target_sid = data.get("target_sid")
    if not target_sid:
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
    """Mendaftarkan koneksi browser guru ke room 'teachers'."""
    room_name = data.get('user').get('room')
    await sio.enter_room(sid, room_name)
    await sio.save_session(sid, {'room': room_name})
    teacher_sids.add(sid)

@sio.on("register_student") # type: ignore
async def on_register_student(sid, data):
    hostname = data.get("hostname", "Unknown-PC")
    device_id = data.get("device_id", hostname) # Fallback ke hostname jika device_id kosong

    # 2. Registrasi / Upsert ke Database SQLite Server & Ambil Status Lock
    device_status = upsert_client_and_get_status_and_name(device_id, hostname)
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

    await sio.enter_room(sid, student_room)
    await sio.enter_room(sid, "teachers")

    target_rooms = ["teachers", student_room]
    await sio.emit(
        "student_connected", name, room=target_rooms
    )
    
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

@sio.on("student_frame") # type: ignore
async def on_student_frame(sid, data):
    """Menerima screenshot layar & telemetri dari PC siswa, lalu menyalurkannya ke guru."""
    # Data disalurkan HANYA ke client yang berada di room 'teachers'
    payload = {
        "sid": data.get("device_id", sid), # Gunakan device_id karena unique dan tidak tergantung koneksi socket
        "hostname": connected_students.get(data.get("device_id"), {}).get("name", "Unknown-PC"),
        "telemetry": data.get("telemetry"),
        "image": data.get("image"),  # Bytes / WebP Frame
    }

    target_rooms = ['teachers', str(payload.get("hostname")).split('-')[0].lower()]
    await sio.emit("update_student_card", payload, room=target_rooms)

@sio.on("send_command") # type: ignore
async def on_send_command(sid, data):
    """
    Menerima perintah remot dari Web Dashboard Guru dan meneruskannya ke Client Siswa.
    Payload: {"target_sid": "all" | "DEVICE_ID", "command": {"action": "lock" | "unlock", ...}}
    """
    command = data.get("command", {})
    action = command.get("action")
    raw_target = data.get("target_sid")
    target_room = (await sio.get_session(sid) or {}).get('room', '')

    # 1. Tentukan target socket SID untuk penyiaran websocket
    if raw_target == "all":
        socket_target = "all"
    else:
        # Mengambil Socket SID asli dari dictionary connected_students (jika key-nya device_id)
        student_info = connected_students.get(raw_target, {})
        socket_target = student_info.get("sid", raw_target)

    # 2. UPDATE DATABASE LOGIC (Gunakan Helper)
    if action in ["lock", "unlock"]:
        is_locked = (action == "lock")
        msg = command.get("message", "DIKUNCI OLEH GURU") if is_locked else ""
        pwd = command.get("password", "") if is_locked else ""

        # Tentukan daftar device_id yang akan diupdate di DB
        if raw_target == "all":
            # Ambil seluruh key (device_id) dari connected_students
            target_device_ids = list(connected_students.keys())
        else:
            target_device_ids = [raw_target]

        # Simpan status terbaru ke database SQLite
        update_clients_lock_status(
            device_ids=target_device_ids,
            is_locked=is_locked,
            message=msg,
            password=pwd
        )

    # 3. KIRIM PERINTAH LEWAT WEBSOCKET
    if socket_target == "all":
        # Kirim perintah ke seluruh client di room guru
        await sio.emit("command", command, skip_sid=list(teacher_sids), room=target_room)
    elif socket_target:
        # Kirim spesifik ke 1 PC siswa saja
        await sio.emit("command", command, to=socket_target)

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

# --- FASTAPI HTTP ROUTES ---
@app.get("/", response_class=HTMLResponse)
async def get_dashboard(request: Request, response: Response):
    """Menyajikan halaman Web Dashboard dengan proteksi autentikasi."""
    try:
        # Mengambil data detail user dari SQLite
        user = await get_current_user(request, response)
        rooms = []
        users = []

        # Ambil data rooms & users hanya jika role direktur atau developer
        if user.get("role") in ["direktur", "developer"]:
            res_rooms = await get_all_rooms()
            res_users = await get_all_users()

            rooms = res_rooms.get('data', [])
            users = res_users.get('data', [])

        return templates.TemplateResponse(
            request=request, 
            name="index.html", 
            context={
                "user": user,
                "users": users, 
                "rooms":rooms,
                "stream_config": STREAM_CONFIG
            }
        )
    except HTTPException as e:
        # Jika token tidak ada, kadaluarsa, atau invalid, redirect langsung ke halaman login
        if e.status_code == status.HTTP_401_UNAUTHORIZED:
            return RedirectResponse(
                url="/login", status_code=status.HTTP_302_FOUND
            )
        raise e

@app.get("/login", response_class=HTMLResponse)
async def get_login_page(request: Request):
    """Menyajikan halaman login."""
    return templates.TemplateResponse(request=request, name="login.html")

# 2. Mount folder static agar file .exe dapat diakses publik via URL
app.mount("/downloads", StaticFiles(directory=UPLOAD_DIR), name="downloads")

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

# Integrating Socket.IO ASGI App ke FastAPI
socket_app = socketio.ASGIApp(sio, app)