document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("macro-modal")) {
        // 1. Buat elemen div utama untuk modal
        const modalElement = document.createElement("div");

        // 2. Set ID dan class Tailwind
        modalElement.id = "macro-modal";
        modalElement.className = "fixed inset-0 bg-black/70 z-50 hidden items-center justify-center p-4";

        // 3. Isi struktur HTML di dalam elemen modal
        modalElement.innerHTML = `
            <!-- Modal Ketik Otomatis (Macro Keyboard) -->
            <div class="bg-gray-900 border border-gray-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">

                <!-- Header Modal -->
                <div class="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
                    <div class="flex items-center gap-2.5">
                        <div class="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center">
                            <i data-lucide="keyboard" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="text-sm font-bold text-gray-100">Ketik Otomatis (Macro)</h3>
                            <p id="macro-target-label" class="text-[11px] text-purple-400 font-mono">Target: Semua PC</p>
                        </div>
                    </div>
                    <button onclick="closeMacroModal()" class="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <!-- Box Indikator Status & Daftar Ketikan -->
                <div class="space-y-3">
                    <div class="flex items-center justify-between bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2">
                        <div class="flex items-center gap-2">
                            <span id="macro-recording-dot" class="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping hidden"></span>
                            <p id="macro-status" class="text-xs font-semibold text-gray-300">Siap Merekam</p>
                        </div>
                        <span id="macro-event-badge" class="text-[10px] font-mono font-bold text-purple-400 bg-purple-950/60 border border-purple-800/50 px-2 py-0.5 rounded-md">
                            0 Event
                        </span>
                    </div>

                    <!-- Area Daftar Ketikan (Scrollable List) -->
                    <div id="macro-list-container" class="h-48 overflow-y-auto bg-gray-950 border border-gray-800 rounded-xl p-2 space-y-1.5 custom-scrollbar">
                        <div class="h-full flex flex-col items-center justify-center text-center text-gray-600 py-6">
                            <i data-lucide="command" class="w-7 h-7 mb-1.5 opacity-40"></i>
                            <p class="text-xs">Belum ada tombol terekam</p>
                            <p class="text-[10px] text-gray-600">Tekan 'Mulai Merekam' untuk memulai</p>
                        </div>
                    </div>

                    <!-- Tombol Sisip Khusus (Virtual System Keys) -->
                    <div class="space-y-1.5">
                        <p class="text-[10px] font-semibold text-gray-400">Sisip Tombol Sistem & Shortcut Kombinasi:</p>
                        <div class="flex flex-wrap gap-1.5">
                            <!-- Sisip Tombol WIN Tunggal -->
                            <button type="button" onclick="insertWinKey()" class="px-2.5 py-1 bg-purple-950/80 hover:bg-purple-900 border border-purple-800/60 text-purple-300 text-[11px] font-mono font-bold rounded-lg transition">
                                + WIN
                            </button>

                            <!-- Preset Kombinasi Penting -->
                            <button type="button" onclick="insertShortcutPreset('win_r')" class="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-300 text-[11px] font-mono font-bold rounded-lg transition">
                                ⚡ WIN + R (Run)
                            </button>
                            <button type="button" onclick="insertShortcutPreset('ctrl_shift_esc')" class="px-2.5 py-1 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800/60 text-indigo-300 text-[11px] font-mono font-bold rounded-lg transition">
                                ⚡ Task Mgr (CTRL+SHIFT+ESC)
                            </button>
                            <button type="button" onclick="insertShortcutPreset('alt_tab')" class="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[11px] font-mono font-bold rounded-lg transition">
                                ⚡ ALT + TAB
                            </button>
                            <button type="button" onclick="insertShortcutPreset('win_d')" class="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[11px] font-mono font-bold rounded-lg transition">
                                ⚡ WIN + D (Desktop)
                            </button>
                            <button type="button" onclick="insertShortcutPreset('win_l')" class="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-800/60 text-rose-300 text-[11px] font-mono font-bold rounded-lg transition">
                                ⚡ WIN + L (Lock)
                            </button>
                        </div>
                    </div>

                    <!-- Instruksi Ringkas -->
                    <div class="bg-purple-950/20 border border-purple-900/30 rounded-xl p-2.5">
                        <p class="text-[11px] text-purple-300 leading-relaxed">
                            💡 Huruf yang diketik memiliki jeda waktu yang tercatat presisi.
                        </p>
                    </div>

                    <!-- Tombol Aksi -->
                    <div class="flex items-center justify-end gap-2 pt-1">
                        <button onclick="closeMacroModal()" class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl transition">
                            Batal
                        </button>

                        <!-- Tombol Mulai Rekam -->
                        <button id="btn-start-record" onclick="startRecordingMacro()" class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-lg shadow-purple-600/20 transition">
                            <i data-lucide="circle-dot" class="w-4 h-4"></i> Mulai Merekam
                        </button>

                        <!-- Tombol Stop & Kirim -->
                        <button id="btn-stop-send" onclick="stopAndSendMacro()" class="hidden px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl items-center gap-1.5 shadow-lg shadow-rose-600/20 transition">
                            <i data-lucide="square" class="w-4 h-4"></i> Hentikan & Eksekusi
                        </button>
                    </div>
                </div>

            </div>
        `;

        // 4. Tambahkan node elemen ke dokumen HTML menggunakan appendChild
        document.body.appendChild(modalElement);

        // Render ulang ikon Lucide jika digunakan
        if (typeof lucide !== "undefined") {
            lucide.createIcons();
        }
    }
});

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