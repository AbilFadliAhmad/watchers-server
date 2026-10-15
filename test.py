import os
import subprocess

setup_path = r"C:\Windows\Temp\WatchersClient_Update.exe"
log_path = r"C:\ProgramData\WatchersAgent\install.log"

DETACHED_PROCESS = 0x00000008
CREATE_NO_WINDOW = 0x08000000

def test_silent_installer():
    if not os.path.exists(setup_path):
        print(f"❌ File tidak ditemukan di path: {setup_path}")
        return

    # 1. Pastikan folder C:\ProgramData\WatchersAgent dibuat terlebih dahulu
    log_dir = os.path.dirname(log_path)
    os.makedirs(log_dir, exist_ok=True)

    print(f"🚀 Memulai eksekusi terpisah (detached) untuk: {setup_path}")
    print(f"📄 Log akan disimpan di: {log_path}")

    try:
        # 2. Hapus tanda petik ganda manual di f"/LOG={log_path}"
        process = subprocess.Popen(
            [setup_path, "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", f"/LOG={log_path}"],
            creationflags=DETACHED_PROCESS | CREATE_NO_WINDOW,
            close_fds=True
        )

        print(f"✅ Proses berhasil dipanggil dengan PID: {process.pid}")
        print("🔍 Silakan periksa Task Manager untuk melihat proses yang berjalan.")

    except Exception as e:
        print(f"❌ Gagal mengeksekusi installer: {e}")

if __name__ == "__main__":
    test_silent_installer()