from fastapi import FastAPI, File,Response, status, Request, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import socketio
import os
import shutil
from auth import (router as auth_router)
from management import (router as management_router, get_all_users, get_all_rooms, fetch_stream_config_from_db)
from auth_middleware import get_current_user
from init_db import init_db
import asyncio

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

# In-memory State Management
# Format: { sid: {"hostname": str, "telemetry": dict, "mode": str} }
connected_students = {}
teacher_sids = set()
active_focus_viewers = {}
STREAM_CONFIG = {}  # Variabel global terpusat di RAM server


# --- SOCKET.IO EVENT HANDLERS ---
@sio.event
async def connect(sid, environ):
    print(f"[+] Client tersambung: {sid}")

@sio.event
async def disconnect(sid):
    if sid in connected_students:
        student = connected_students.pop(sid)
        print(f"[-] Siswa terputus: {student.get('hostname')}")
        # Beritahu semua dashboard guru bahwa siswa ini offline
        await sio.emit("student_disconnected", student, room="teachers")
    elif sid in teacher_sids:
        to_remove = [] # untuk hapus fullscreen

        for target_sid, viewers in active_focus_viewers.items():
            if sid in viewers:
                viewers.remove(sid)
                # Jika tidak ada penonton tersisa di PC tersebut
                if len(viewers) == 0:
                    to_remove.append(target_sid) # mengapa tidak langsung hapus key disctionary karena masih di iterasi dan itu dapat menyebabkan error jika dihapus saat iterasi saat ini
                    await sio.emit(
                        "command",
                        {"action": "set_mode", "mode": "grid"},
                        to=target_sid,
                    )
        # menghapus key dictionary, mengapa ini berhasil karena yang dijadikan perulangan bukanlah dictionary active_focus_viewers melainkan array to_remove
        for target_sid in to_remove:
            del active_focus_viewers[target_sid]

        teacher_sids.remove(sid)
        print(f"[-] Guru terputus: {sid}")


# --- BACKGROUND TASK: SINKRONISASI DATABASE 10 MENIT SEKALI ---
async def config_sync_loop():
    """Mengecek database setiap 10 menit (600 detik).

    Jika Admin mengubah data di DB, RAM Server dan seluruh PC Siswa akan
    diperbarui otomatis.
    """
    global STREAM_CONFIG
    while True:
        try:
            # Jeda 10 menit (600 detik)
            await asyncio.sleep(600)

            # Ambil nilai terbaru dari Database SQLite
            latest_config = fetch_stream_config_from_db()

            # Jika ada perubahan dibanding data yang tersimpan di RAM Server
            if latest_config != STREAM_CONFIG:
                STREAM_CONFIG = latest_config
                print(
                    f"[*] STREAM_CONFIG diperbarui dari DB (10-Min Sync): {STREAM_CONFIG}"
                )

                # Broadcast konfigurasi terbaru ke SELURUH PC siswa yang sedang online
                await sio.emit("update_config", STREAM_CONFIG)
        except Exception as e:
            print(f"[!] Error pada config_sync_loop: {e}")


@sio.on("start_focus_view")
async def on_start_focus(sid, data):
    target_sid = data.get("target_sid")
    print('wleeee', target_sid)
    if not target_sid:
        return

    if target_sid not in active_focus_viewers:
        active_focus_viewers[target_sid] = set()

    active_focus_viewers[target_sid].add(sid)

    # Perintahkan PC siswa untuk masuk mode 15 FPS (focus)
    await sio.emit(
        "command", {"action": "set_mode", "mode": "focus"}, to=target_sid
    )

@sio.on("stop_focus_view")
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


@sio.on("register_teacher")
async def on_register_teacher(sid, data):
    """Mendaftarkan koneksi browser guru ke room 'teachers'."""
    room_name = data.get('user').get('room')
    await sio.enter_room(sid, room_name)
    await sio.save_session(sid, {'room': room_name})
    teacher_sids.add(sid)
    # Kirimkan data konfigurasi RAM server ke client siswa yang baru mendaftar
    await sio.emit("update_config", STREAM_CONFIG, to=sid)


@sio.on("register_student")
async def on_register_student(sid, data):
    """Mendaftarkan client PC siswa ke memori server dan room Socket.IO."""
    hostname = data.get("hostname", "Unknown-PC")
    student_room = hostname.split("-")[0].lower()

    connected_students[sid] = {
        "sid": sid,
        "hostname": hostname,
        "room": student_room,
        "telemetry": {"cpu": 0, "ram": 0, "open_windows": []},
        "mode": "grid",
    }
    print(connected_students[sid]["hostname"])
    # PERBAIKAN: Masukkan siswa ke room kelasnya DAN room 'teachers'
    await sio.enter_room(sid, student_room)
    await sio.enter_room(sid, "teachers")

    target_rooms = ["teachers", student_room]
    await sio.emit(
        "student_connected", connected_students[sid]["hostname"], room=target_rooms
    )


@sio.on("student_frame")
async def on_student_frame(sid, data):
    """Menerima screenshot layar & telemetri dari PC siswa, lalu menyalurkannya ke guru."""
    if sid in connected_students:
        connected_students[sid]["telemetry"] = data.get("telemetry", {})

    # Data disalurkan HANYA ke client yang berada di room 'teachers'
    payload = {
        "sid": sid,
        "hostname": data.get("hostname"),
        "telemetry": data.get("telemetry"),
        "image": data.get("image"),  # Bytes / WebP Frame
    }

    target_rooms = ['teachers', payload.get("hostname").split('-')[0].lower()]
    await sio.emit("update_student_card", payload, room=target_rooms)

@sio.on("send_command")
async def on_send_command(sid, data):
    """
    Menerima perintah remot dari Web Dashboard Guru dan meneruskannya ke Client Siswa.
    Payload: {"target_sid": "all" | "SID_TERTENTU", "command": {"action": "lock", ...}}
    """

    command = data.get("command")
    target_sid = data.get("target_sid")
    target_room = (await sio.get_session(sid) or {}).get('room', '')
    # 1. Gunakan await dan ambil key "room" dari dict user

    if target_sid == "all":
        # Kirim perintah ke seluruh client (abaikan koneksi guru)
        await sio.emit("command", command, skip_sid=list(teacher_sids), room=target_room)
    else:
        # Kirim spesifik ke 1 PC siswa saja
        await sio.emit("command", command, to=target_sid)


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
            request=request, name="index.html", context={"user": user, "users": users, 'rooms':rooms}
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
    if not file.filename.endswith(".exe"):
        raise HTTPException(
            status_code=400, detail="Hanya file .exe yang diizinkan."
        )

    file_path = os.path.join(UPLOAD_DIR, file.filename)

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