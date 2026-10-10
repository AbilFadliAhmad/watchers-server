function openStreamConfigModal() {
    const modal = document.getElementById('stream-config-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeStreamConfigModal() {
    const modal = document.getElementById('stream-config-modal');
    if (modal) modal.classList.add('hidden');
}

// Toggle Tampilan Input Custom Scale
function toggleCustomScale(mode) {
    const select = document.getElementById(`${mode}-scale-select`);
    const container = document.getElementById(`${mode}-scale-custom-container`);
    
    if (select.value === 'custom') {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}

// --- SINKRONISASI MODE GRID (1 - 60 Detik, Bulat) ---
function syncGridSlider(val) {
    let num = Math.round(parseInt(val) || 5);
    num = Math.max(1, Math.min(60, num));
    document.getElementById('grid-interval-slider').value = num;
    document.getElementById('grid-interval-num').value = num;
}

function syncGridInput(val) {
    let num = Math.round(parseInt(val) || 1);
    num = Math.max(1, Math.min(60, num));
    document.getElementById('grid-interval-slider').value = num;
    document.getElementById('grid-interval-num').value = num;
}

// --- SINKRONISASI MODE FULLSCREEN (1 - 60 FPS, Bulat) ---
function syncFullscreenSlider(val) {
    let num = Math.round(parseInt(val) || 15);
    num = Math.max(1, Math.min(60, num));
    document.getElementById('fullscreen-fps-slider').value = num;
    document.getElementById('fullscreen-fps-num').value = num;
}

function syncFullscreenInput(val) {
    let num = Math.round(parseInt(val) || 1);
    num = Math.max(1, Math.min(10, num));
    document.getElementById('fullscreen-fps-slider').value = num;
    document.getElementById('fullscreen-fps-num').value = num;
}

// --- KIRIM KONFIGURASI KE BACKEND FASTAPI ---
async function submitStreamConfig() {
    const gridIntervalSec = parseInt(document.getElementById('grid-interval-num').value) || 5;
    const fullscreenFps = parseInt(document.getElementById('fullscreen-fps-num').value) || 15;

    // Hitung interval detik untuk agent dari FPS
    const fullscreenIntervalSec = parseFloat((1 / fullscreenFps).toFixed(4));

    // Ambil Resolusi Grid
    const gridSelect = document.getElementById('grid-scale-select').value;
    let gridW, gridH;
    if (gridSelect === 'custom') {
        gridW = parseInt(document.getElementById('grid-scale-w').value) || 640;
        gridH = parseInt(document.getElementById('grid-scale-h').value) || 360;
    } else {
        [gridW, gridH] = gridSelect.split('x').map(Number);
    }

    // Ambil Resolusi Fullscreen
    const fullscreenSelect = document.getElementById('fullscreen-scale-select').value;
    let fsW, fsH;
    if (fullscreenSelect === 'custom') {
        fsW = parseInt(document.getElementById('fullscreen-scale-w').value) || 1280;
        fsH = parseInt(document.getElementById('fullscreen-scale-h').value) || 720;
    } else {
        [fsW, fsH] = fullscreenSelect.split('x').map(Number);
    }

    // Payload yang dikirim ke Backend FastAPI
    const payload = {
        grid: {
            quality: 50,
            scale_width: gridW,
            scale_height: gridH,
            interval: gridIntervalSec
        },
        fullscreen: {
            quality: 70,
            scale_width: fsW,
            scale_height: fsH,
            interval: fullscreenIntervalSec
        }
    };

    try {
        const response = await fetch('/api/stream-settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast('Konfigurasi Stream berhasil disimpan dan disiarkan ke seluruh Komputer!', 'success');
            closeStreamConfigModal();
        } else {
            const err = await response.json();
            showToast('Gagal memperbarui: ' + (err.detail || 'Terjadi kesalahan'), 'error');
        }
    } catch (e) {
        console.error(e);
        alert('Gagal terhubung ke server.');
    }
}