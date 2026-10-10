document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("url-modal")) {
        // 1. Buat elemen div utama untuk modal
        const modalElement = document.createElement("div");

        // 2. Set ID dan class Tailwind
        modalElement.id = "url-modal";
        modalElement.className = "fixed inset-0 bg-black/70 z-50 hidden items-center justify-center p-4";

        // 3. Isi struktur HTML di dalam elemen modal
        modalElement.innerHTML = `
            <div class="bg-gray-900 border border-gray-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">

                <!-- Header Modal -->
                <div class="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
                    <div class="flex items-center gap-2.5">
                        <div class="w-9 h-9 rounded-xl bg-sky-600/20 border border-sky-500/30 text-sky-400 flex items-center justify-center">
                            <i data-lucide="globe" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="text-sm font-bold text-gray-100">Buka URL Web</h3>
                            <p id="url-target-label" class="text-[11px] text-sky-400 font-mono">Target: Semua PC</p>
                        </div>
                    </div>
                    <button onclick="closeUrlModal()" class="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <!-- Form Input -->
                <div class="space-y-4">
                    <div>
                        <label for="input-target-url" class="block text-xs font-semibold text-gray-300 mb-1.5">Alamat Website (URL)</label>
                        <div class="relative">
                            <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                                <i data-lucide="link" class="w-4 h-4"></i>
                            </span>
                            <input type="text" id="input-target-url" placeholder="https://google.com atau classroom.google.com"
                                class="w-full pl-9 pr-3 py-2.5 bg-gray-950 border border-gray-800 focus:border-sky-500 rounded-xl text-xs text-gray-100 placeholder-gray-600 focus:outline-none transition">
                        </div>
                        <p class="text-[10px] text-gray-500 mt-1">Sistem akan otomatis membuka browser default pada PC client.</p>
                    </div>

                    <!-- Tombol Aksi -->
                    <div class="flex items-center justify-end gap-2 pt-2">
                        <button onclick="closeUrlModal()" class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl transition">
                            Batal
                        </button>
                        <button onclick="submitUrlCommand()" class="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-lg shadow-sky-600/20 transition">
                            <i data-lucide="external-link" class="w-4 h-4"></i> Buka Browser
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

// Membuka Modal Kunjungi URL
function openUrlModal(sid = 'all', hostname = 'Semua PC') {
    activeSid = sid;
    activeHostname = hostname;

    const modal = document.getElementById('url-modal');
    const label = document.getElementById('url-target-label');
    const input = document.getElementById('input-target-url');

    label.innerText = `Target: ${hostname}`;
    input.value = ''; // Reset input
    input.focus(); // Fokus ke input saat modal dibuka
    input.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            submitUrlCommand();
        }
    });

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Auto focus ke input setelah modal muncul
    setTimeout(() => input.focus(), 100);
}

// Menutup Modal Kunjungi URL
function closeUrlModal() {
    const modal = document.getElementById('url-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    targetUrlSid = null;
}

// Mengirimkan Perintah open_url
function submitUrlCommand() {
    const input = document.getElementById('input-target-url');
    let rawUrl = input.value.trim();
    const targetSid = activeSid || 'all';

    if (!rawUrl) {
        alert("Silakan masukkan URL website terlebih dahulu!");
        return;
    }

    // Otomatis tambahkan 'https://' jika pengguna hanya mengetikkan domain biasa (misal: google.com)
    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
        rawUrl = 'https://' + rawUrl;
    }

    // Kirim perintah SocketIO
    sendDirectCommand(targetSid, 'open_url', { url: rawUrl });

    // Notifikasi Toast
    if (typeof Toastify === 'function') {
        Toastify({
            text: `🌐 Membuka ${rawUrl} di client...`,
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "#0c4a6e", color: "#38bdf8", border: "1px solid #0284c7", borderRadius: "0.75rem" }
        }).showToast();
    }

    closeUrlModal();
}