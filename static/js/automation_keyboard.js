let isRecordingMacro = false;
let macroEvents = [];
let lastMacroTime = 0;

// 1. Membuka Modal
function openMacroModal(sid = null, hostname = 'Semua PC') {
    activeSid = sid;
    activeHostname = hostname;

    document.getElementById('macro-target-label').innerText = `Target: ${hostname}`;
    resetMacroState();

    const modal = document.getElementById('macro-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) lucide.createIcons();
}

// 2. Menutup Modal
function closeMacroModal() {
    if (isRecordingMacro) stopRecordingMacro();
    const modal = document.getElementById('macro-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    targetMacroSid = null;
}

// 3. Reset State Perekaman & Kosongkan Tampilan List
function resetMacroState() {
    isRecordingMacro = false;
    macroEvents = [];
    lastMacroTime = 0;

    document.getElementById('macro-status').innerText = 'Siap Merekam';
    document.getElementById('macro-event-badge').innerText = '0 Event';
    document.getElementById('macro-recording-dot').classList.add('hidden');

    document.getElementById('btn-start-record').classList.remove('hidden');
    document.getElementById('btn-stop-send').classList.add('hidden');
    document.getElementById('btn-stop-send').classList.remove('flex');

    // Kembalikan tampilan list ke placeholder awal
    const container = document.getElementById('macro-list-container');
    container.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center text-center text-gray-600 py-6">
            <i data-lucide="command" class="w-7 h-7 mb-1.5 opacity-40"></i>
            <p class="text-xs">Belum ada tombol terekam</p>
            <p class="text-[10px] text-gray-600">Tekan 'Mulai Merekam' untuk memulai</p>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

// 4. Mulai Merekam Ketikan Keyboard
function startRecordingMacro() {
    isRecordingMacro = true;
    macroEvents = [];
    lastMacroTime = performance.now();

    document.getElementById('macro-status').innerText = 'Sedang Merekam Ketikan...';
    document.getElementById('macro-recording-dot').classList.remove('hidden');

    document.getElementById('btn-start-record').classList.add('hidden');
    document.getElementById('btn-stop-send').classList.remove('hidden');
    document.getElementById('btn-stop-send').classList.add('flex');

    // Pasang listener keyboard global
    window.addEventListener('keydown', handleMacroKeyDown);
    window.addEventListener('keyup', handleMacroKeyUp);
}

// Handler KeyDown
function handleMacroKeyDown(e) {
    if (!isRecordingMacro) return;
    e.preventDefault(); // Mencegah aksi bawaan browser (seperti F5, Tab focus, dll)
    recordKeyEvent(e.key, 'press');
}

// Handler KeyUp
function handleMacroKeyUp(e) {
    if (!isRecordingMacro) return;
    e.preventDefault();
    recordKeyEvent(e.key, 'release');
}

// 1. Fungsi Sisip Tombol Windows (+ WIN)
function insertWinKey() {
    if (!isRecordingMacro) {
        showToast("⚠️ Klik 'Mulai Merekam' terlebih dahulu!", "error");
        return;
    }
    // Menggunakan key 'Meta' yang otomatis dikonversi recordKeyEvent ke Key.cmd
    recordKeyEvent('Meta', 'press');
    recordKeyEvent('Meta', 'release');
}

// 2. Fungsi Sisip Shortcut Kombinasi Penting
function insertShortcutPreset(type) {
    if (!isRecordingMacro) {
        showToast("⚠️ Klik 'Mulai Merekam' terlebih dahulu!", "error");
        return;
    }

    switch(type) {
        case 'win_r': // Buka Dialog Run
            recordKeyEvent('Meta', 'press');
            recordKeyEvent('r', 'press');
            recordKeyEvent('r', 'release');
            recordKeyEvent('Meta', 'release');
            break;

        case 'ctrl_shift_esc': // Buka Task Manager
            recordKeyEvent('Control', 'press');
            recordKeyEvent('Shift', 'press');
            recordKeyEvent('Escape', 'press');
            recordKeyEvent('Escape', 'release');
            recordKeyEvent('Shift', 'release');
            recordKeyEvent('Control', 'release');
            break;

        case 'alt_tab': // Pindah Jendela
            recordKeyEvent('Alt', 'press');
            recordKeyEvent('Tab', 'press');
            recordKeyEvent('Tab', 'release');
            recordKeyEvent('Alt', 'release');
            break;

        case 'win_d': // Minimize Semua / Tampilkan Desktop
            recordKeyEvent('Meta', 'press');
            recordKeyEvent('d', 'press');
            recordKeyEvent('d', 'release');
            recordKeyEvent('Meta', 'release');
            break;

        case 'win_l': // Penguncian Windows
            recordKeyEvent('Meta', 'press');
            recordKeyEvent('l', 'press');
            recordKeyEvent('l', 'release');
            recordKeyEvent('Meta', 'release');
            break;
    }
}

// Rekam Event & Tambahkan Baris Baru ke List
function recordKeyEvent(key, action) {
    const now = performance.now();
    const delay = (now - lastMacroTime) / 1000;
    lastMacroTime = now;

    // Pemetaan nama tombol JS ke pynput Python
    let keyStr = key;
    if (key === ' ') keyStr = 'Space';
    else if (key === 'Control') keyStr = 'Key.ctrl';
    else if (key === 'Shift') keyStr = 'Key.shift';
    else if (key === 'Alt') keyStr = 'Key.alt';
    else if (key === 'Enter') keyStr = 'Key.enter';
    else if (key === 'Backspace') keyStr = 'Key.backspace';
    else if (key === 'Tab') keyStr = 'Key.tab';
    else if (key === 'Escape') keyStr = 'Key.esc';
    else if (key === 'ArrowRight') keyStr = 'Key.right';
    else if (key === 'ArrowLeft') keyStr = 'Key.left';
    else if (key === 'ArrowUp') keyStr = 'Key.up';
    else if (key === 'ArrowDown') keyStr = 'Key.down';
    else if (key === 'Meta') keyStr = 'Key.cmd';

    const eventObj = {
        key: keyStr,
        action: action,
        delay: parseFloat(delay.toFixed(3))
    };
    macroEvents.push(eventObj);

    if (action !== 'press') return
    // Hapus placeholder kosong jika ini event pertama
    const container = document.getElementById('macro-list-container');
    if (macroEvents.length === 1) {
        container.innerHTML = '';
    }

    const displayKeyName = keyStr.replace('Key.', '').toUpperCase();
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between bg-gray-900 border border-gray-800/90 px-3 py-1.5 rounded-lg text-xs font-mono transition';
    row.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">PRESS</span>
            <span class="font-bold text-purple-300">${displayKeyName}</span>
        </div>
        <span class="text-[10px] text-gray-500">+${eventObj.delay}s</span>
    `;

    container.appendChild(row);

    // Auto-scroll otomatis ke item paling bawah
    container.scrollTop = container.scrollHeight;

    // Perbarui jumlah event
    document.getElementById('macro-event-badge').innerText = `${macroEvents.length} Event`;
}

// Hentikan Listener
function stopRecordingMacro() {
    isRecordingMacro = false;
    window.removeEventListener('keydown', handleMacroKeyDown);
    window.removeEventListener('keyup', handleMacroKeyUp);
}

// 5. Hentikan & Kirim Data Macro ke Client via SocketIO
function stopAndSendMacro() {
    stopRecordingMacro();

    if (macroEvents.length === 0) {
        alert("Tidak ada event ketikan yang terekam!");
        resetMacroState();
        return;
    }

    const targetSid = activeSid || 'all';

    // Kirim command execute_macro beserta data events ke server/client
    sendDirectCommand(targetSid, 'execute_macro', { events: macroEvents });

    // Toast Notifikasi
    if (typeof Toastify === 'function') {
        Toastify({
            text: `⌨️ Mengirim ${macroEvents.length} event ketikan ke client...`,
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "#3b0764", color: "#c084fc", border: "1px solid #7e22ce", borderRadius: "0.75rem" }
        }).showToast();
    }

    closeMacroModal();
}