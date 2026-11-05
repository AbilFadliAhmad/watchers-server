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
                        <label for="input-target-url" class="block text-xs font-semibold text-gray-300 mb-1.5">Alamat Website / IP Address</label>
                        <div class="relative">
                            <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                                <i data-lucide="link" class="w-4 h-4"></i>
                            </span>
                            <input onkeydown="if(event.key === 'Enter') submitUrlCommand()" type="text" id="input-target-url" placeholder="google.com atau 192.168.1.1"
                                class="w-full pl-9 pr-3 py-2.5 bg-gray-950 border border-gray-800 focus:border-sky-500 rounded-xl text-xs text-gray-100 placeholder-gray-600 focus:outline-none transition">
                        </div>
                        <p class="text-[10px] text-gray-500 mt-1">Dapat berupa URL domain (google.com) atau IP Lokal (192.168.1.1).</p>
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

        // 4. Tambahkan node elemen ke dokumen HTML
        document.body.appendChild(modalElement);

        if (typeof lucide !== "undefined") {
            lucide.createIcons();
        }
    }
});

// Fungsi Validator URL & IP Address
function parseAndValidateUrl(inputStr) {
    if (!inputStr) return { valid: false };

    let urlToCheck = inputStr.trim();
    const isIpPattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::\d+)?(?:[/?#].*)?$/;
    const hasProtocol = /^https?:\/\//i.test(urlToCheck);

    // Jika belum ada http:// atau https://
    if (!hasProtocol) {
        // Jika berupa IP Address, gunakan default http://, selain itu gunakan https://
        urlToCheck = (isIpPattern.test(urlToCheck) ? 'http://' : 'https://') + urlToCheck;
    }

    try {
        const parsed = new URL(urlToCheck);
        const hostname = parsed.hostname;

        // 1. Validasi IP Address (IPv4: 4 oktek 0-255)
        const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
        if (ipv4Regex.test(hostname)) {
            const octets = hostname.split('.').map(Number);
            if (octets.every(o => o >= 0 && o <= 255)) {
                return { valid: true, formattedUrl: urlToCheck };
            }
        }

        // 2. Validasi Localhost
        if (hostname === 'localhost') {
            return { valid: true, formattedUrl: urlToCheck };
        }

        // 3. Validasi Domain Publik (Harus ada titik '.' dan TLD minimal 2 karakter, contoh: google.com)
        const domainRegex = /^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
        if (domainRegex.test(hostname)) {
            return { valid: true, formattedUrl: urlToCheck };
        }

        return { valid: false };
    } catch (e) {
        return { valid: false };
    }
}

// Membuka Modal Kunjungi URL
function openUrlModal(sid = 'all', hostname = 'Semua PC') {
    activeSid = sid;
    activeHostname = hostname;

    const modal = document.getElementById('url-modal');
    const label = document.getElementById('url-target-label');
    const input = document.getElementById('input-target-url');

    label.innerText = `Target: ${hostname}`;
    input.value = '';

    modal.classList.remove('hidden');
    modal.classList.add('flex');

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
    const rawInput = input.value.trim();
    const targetSid = activeSid || 'all';

    if (!rawInput) {
        alert("Silakan masukkan URL website atau IP Address terlebih dahulu!");
        return;
    }

    // Validasi URL / IP Address
    const validation = parseAndValidateUrl(rawInput);
    if (!validation.valid) {
        showToast("Format URL atau IP Address tidak valid! Contoh: google.com atau 192.168.1.1", "error");
        input.focus();
        return;
    }
    const finalUrl = validation.formattedUrl;

    // Kirim perintah SocketIO
    sendDirectCommand(targetSid, 'open_url', { 
        url: finalUrl, 
        log_details: `Perintah buka URL dikirim melalui panel manajemen. URL: "${finalUrl}"`, 
        is_warning: false 
    });

    // Notifikasi Toast
    if (typeof Toastify === 'function') {
        Toastify({
            text: `🌐 Membuka ${finalUrl} di client...`,
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "#0c4a6e", color: "#38bdf8", border: "1px solid #0284c7", borderRadius: "0.75rem" }
        }).showToast();
    }

    closeUrlModal();
}