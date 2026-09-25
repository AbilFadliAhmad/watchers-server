// 1. Membuka Mode Fullscreen & Mengunci Mode Landscape HP
async function openFullscreenView(sid, hostname) {
    activeSid = sid;
    activeHostname = hostname;

    const viewer = document.getElementById('fullscreen-viewer');
    const viewerImg = document.getElementById('fullscreen-img');
    const hostnameText = document.getElementById('fullscreen-hostname-text');

    // Ambil gambar saat ini dari kartu PC
    const sourceImg = document.querySelector(`#pc-${sid} .student-screen`);
    if (sourceImg) viewerImg.src = sourceImg.src;

    hostnameText.innerText = hostname;
    viewer.classList.remove('hidden');
    viewer.classList.add('flex');

    // Minta browser masuk ke mode Native Fullscreen
    try {
        if (viewer.requestFullscreen) {
            await viewer.requestFullscreen();
        } else if (viewer.webkitRequestFullscreen) { // Safari iOS/Mac
            await viewer.webkitRequestFullscreen();
        }

        // Otomatis ubah orientasi layar HP menjadi Landscape
        if (screen.orientation && screen.orientation.lock) {
            await screen.orientation.lock('landscape').catch(() => {
                // Abaikan jika browser desktop menolak lock orientation
            });
        }
    } catch (err) {
        console.warn("Fullscreen request error:", err);
    }

    // A. MASUKKAN STATE DUMMY KE BROWSER HISTORY (Agar Tombol Back HP/Browser Terperangkap)
    history.pushState({ inFullscreen: true }, "");

    console.log('ada yang salah taa');
    // B. Beritahu server via SocketIO untuk beralih ke mode 15 FPS (focus)
    socket.emit("start_focus_view", { target_sid: sid });
}

// 2. Fungsi Ambil & Download Screenshot Frame Saat Ini
function takeFullscreenScreenshot() {
    const viewerImg = document.getElementById('fullscreen-img');
    if (!viewerImg.src) return;

    const a = document.createElement('a');
    a.href = viewerImg.src;
    a.download = `Screenshot_${activeHostname}_${new Date().toISOString().slice(0,19).replace(/[:T]/g, '-')}.webp`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Notifikasi Toastify
    if (typeof Toastify === 'function') {
        Toastify({
            text: `📸 Screenshot ${activeHostname} berhasil diunduh!`,
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "#0f172a", color: "#818cf8", border: "1px solid #374151", borderRadius: "0.75rem" }
        }).showToast();
    }
}

// 3. Fungsi Keluar dari Fullscreen Mode
function exitCustomFullscreen() {
    if (!activeSid) return;

    // KIRIM EVENT SOCKETIO STOP_FOCUS_VIEW KE SERVER (Kunci Utama)
    socket.emit("stop_focus_view", { target_sid: activeSid });

    if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }

    // Unlock orientasi layar HP
    if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
    }

    const viewer = document.getElementById('fullscreen-viewer');
    viewer.classList.add('hidden');
    viewer.classList.remove('flex');
    activeSid = null;
}

// ------------------------------------------------------------------
// EVENT LISTENERS UNTUK MENANGKAP TOMBOL BACK & ESC
// ------------------------------------------------------------------

// 1. Menangkap Event Tombol Back Browser / Gesture Back HP
window.addEventListener('popstate', (event) => {
    if (activeSid) {
        exitCustomFullscreen();
    }
});

// 2. Menangkap Event ESC Keyboard atau Penghentian Fullscreen Sistem
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && activeSid) {
        exitCustomFullscreen();
    }
});