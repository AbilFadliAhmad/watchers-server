from fastapi import FastAPI, File,Response, status, Request, HTTPException, UploadFile, Query
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import socketio
import os
import shutil
from auth import (router as auth_router)
from client_helper import get_active_installer_config, update_clients_lock_status, upsert_client_and_get_info_device, verify_client_password
from management import (router as management_router, get_management_data, fetch_stream_config_from_db, get_logs_data, record_activity_log)
from auth_middleware import get_current_user
from typing import Optional
from init_db import init_db

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
    room_name = data.get('user').get('room')
    await sio.enter_room(sid, room_name)
    await sio.save_session(sid, {'room': room_name})
    teacher_sids.add(sid)

@sio.on("register_student") # type: ignore
async def on_register_student(sid, data):
    hostname = data.get("hostname", "Unknown-PC")
    device_id = data.get("device_id", hostname) # Fallback ke hostname jika device_id kosong

    # 2. Registrasi / Upsert ke Database SQLite Server & Ambil Status Lock
    device_status = upsert_client_and_get_info_device(device_id, hostname)
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
            "sha256": CURRENT_SHA256,
            "download_url": CURRENT_URL_DOWNLOAD,
        }

        print(f"[DEBUG] payload update dikirim ke {device_id}: {update_payload}", flush=True)

        # Kirim sinyal update HANYA ke socket client ini (sid)
        await sio.emit("trigger_update", update_payload, to=sid)

    # Data disalurkan HANYA ke client yang berada di room 'all'
    payload = {
        "sid": device_id,
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

@sio.on("send_command") # type: ignore
async def on_send_command(sid, data):
    """
    Menerima perintah remot dari Web Dashboard Guru dan meneruskannya ke Client Siswa.
    Payload: {"target_sid": "all" | "DEVICE_ID", "command": {"action": "message", "is_warning": "iya" | false, ...}}
    """

    command = data.get("command", {})
    action = command.get("action")
    is_warning = command.get("is_warning", False)
    log_details = command.get("log_details", "Tidak ada catatan")  # Default jika tidak ada log_details
    raw_target = data.get("target_sid")
    target_room = (await sio.get_session(sid) or {}).get('room', '')
    executed_by = data.get("executed_by")

    # 1. Tentukan target socket SID untuk penyiaran websocket
    if raw_target == "all":
        socket_target = "all"
    else:
        student_info = connected_students.get(raw_target, {})
        socket_target = student_info.get("sid", raw_target)

    # 2. UPDATE DATABASE LOGIC (Status Kunci Layar)
    if action in ["lock", "unlock"]:
        is_locked = (action == "lock")
        msg = command.get("message", "DIKUNCI OLEH GURU") if is_locked else ""
        pwd = command.get("password", "") if is_locked else ""

        if raw_target == "all":
            target_device_ids = list(connected_students.keys())
        else:
            target_device_ids = [raw_target]

        update_clients_lock_status(
            device_ids=target_device_ids,
            is_locked=is_locked,
            message=msg,
            password=pwd
        )

    # 3. RECORD LOG & PELANGGARAN
    record_activity_log(
        client_id=raw_target,
        action_type=action,
        details=log_details,
        executed_by=executed_by,
        is_warning=is_warning
    )

    # 4. KIRIM PERINTAH LEWAT WEBSOCKET
    if socket_target == "all":
        await sio.emit("command", command, skip_sid=list(teacher_sids), room=target_room)
    elif socket_target:
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
@app.get("/")
async def get_home(request: Request, response: Response):
    """Menyajikan halaman utama."""
    try:
            # Cek sesi autentikasi pengguna saat ini
            user = await get_current_user(request, response)
            if user:
                return RedirectResponse(url="/control", status_code=status.HTTP_302_FOUND)
            else:
                # Memicu HTTPException secara manual agar melompat ke blok except di bawah
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    except HTTPException:
            # Jika token tidak ada / expired (401), biarkan lanjut menampilkan halaman login
            pass
    
    return templates.TemplateResponse(request=request, name="index.html")

@app.get("/landing")
async def get_landing(request: Request, response: Response):
    """Menyajikan halaman landing."""
    try:
            # Cek sesi autentikasi pengguna saat ini
            user = await get_current_user(request, response)
            if user:
                return RedirectResponse(url="/control", status_code=status.HTTP_302_FOUND)
            else:
                # Memicu HTTPException secara manual agar melompat ke blok except di bawah
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    except HTTPException:
            # Jika token tidak ada / expired (401), biarkan lanjut menampilkan halaman login
            pass
    
    return templates.TemplateResponse(request=request, name="landing.html")

@app.get("/control")
async def get_control(request: Request, response: Response):
    """Menyajikan halaman Web Dashboard dengan data manajemen terpadu."""
    try:
        user = await get_current_user(request, response)
        mgmt_data = await get_management_data(user.get("role", ""))

        template_res =  templates.TemplateResponse(
            request=request,
            name="control.html",
            context={
                "user": user,
                "users": mgmt_data["users"],
                "rooms": mgmt_data["rooms"],
                "roles": mgmt_data["roles"],
                "installers": mgmt_data["installers"],
                "stream_config": STREAM_CONFIG
            }
        )

        # Salin cookie dari dependency ke TemplateResponse
        for key, value in response.headers.items():
            if key.lower() == "set-cookie":
                template_res.headers.append("set-cookie", value)

        return template_res

    except HTTPException as e:
        if e.status_code == status.HTTP_401_UNAUTHORIZED:
            return RedirectResponse(
                url="/", status_code=status.HTTP_302_FOUND
            )
        raise e

@app.get("/login", response_class=HTMLResponse)
async def get_login_page(request: Request, response: Response):
    """Menyajikan halaman login. Jika pengguna sudah login, redirect ke halaman utama."""
    try:
        # Cek sesi autentikasi pengguna saat ini
        user = await get_current_user(request, response)
        if user:
            return RedirectResponse(url="/control", status_code=status.HTTP_302_FOUND)
        else:
            # Memicu HTTPException secara manual agar melompat ke blok except di bawah
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    except HTTPException:
            # Jika token tidak ada / expired (401), biarkan lanjut menampilkan halaman login
            pass

    return templates.TemplateResponse(request=request, name="login.html")

@app.get("/logs", response_class=HTMLResponse)
async def get_logs_page(
    request: Request,
    response: Response,
    action: Optional[str] = Query(None),
    time_range: Optional[str] = Query("1w")
):
    """Menyajikan halaman HTML Log & Pelanggaran."""
    try:
        user = await get_current_user(request, response)
        selected_time = time_range if time_range in TIME_RANGE_MAP else "1w"
        
        data = await get_logs_data(
            current_user=user, 
            action=action, 
            time_range=selected_time
        )
        
        return templates.TemplateResponse(
            request=request,
            name="logs.html",
            context={
                "user": user,
                "violations": data["violations"],
                "logs": data["logs"],
                "selected_action": action or "",
                "selected_time_range": selected_time
            }
        )
    except HTTPException as e:
        if e.status_code == status.HTTP_401_UNAUTHORIZED:
            return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)
        raise e

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