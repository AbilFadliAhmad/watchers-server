document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("confirm-modal")) {
        // 1. Buat elemen div utama untuk modal
        const modalElement = document.createElement("div");

        // 2. Set ID dan class Tailwind
        modalElement.id = "confirm-modal";
        modalElement.className = "fixed inset-0 bg-black/70 z-50 flex items-center justify-center hidden opacity-0 transition-all duration-200";

        // 3. Isi struktur HTML di dalam elemen modal
        modalElement.innerHTML = `
            <div class="bg-gray-900 border border-rose-900/50 rounded-2xl w-full max-w-sm p-5 shadow-2xl transform scale-95 transition-all duration-200 text-center">
                
                <!-- Icon Power -->
                <div class="w-12 h-12 bg-rose-950 border border-rose-800/50 rounded-full flex items-center justify-center mx-auto mb-3 text-rose-500">
                    <i data-lucide="power" class="w-6 h-6"></i>
                </div>
                
                <h3 id="confirm-title" class="font-bold text-base text-gray-100 mb-1">Kontrol Daya PC</h3>
                <p id="confirm-desc" class="text-xs text-gray-400 mb-4">Pilih tindakan daya untuk komputer ini.</p>
                
                <!-- Dropdown Pilihan Aksi Daya -->
                <div class="mb-5 text-left">
                    <label class="text-[11px] font-semibold text-gray-400 block mb-1.5">Pilih Aksi Daya:</label>
                    <select id="power-action-select" class="w-full bg-gray-950 border border-gray-800 text-xs text-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-rose-500 transition cursor-pointer">
                        <option value="shutdown">🔴 Matikan PC (Shutdown)</option>
                        <option value="restart">🔄 Mulai Ulang PC (Restart)</option>
                    </select>
                </div>

                <!-- Tombol Aksi -->
                <div class="flex justify-center gap-2">
                    <button onclick="closeConfirmModal()" class="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold py-2.5 rounded-lg transition">Batal</button>
                    <button id="btn-execute-confirm" class="w-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-1.5">
                        <i data-lucide="power" class="w-3.5 h-3.5"></i>
                        <span id="btn-execute-text">Ya, Matikan</span>
                    </button>
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

function confirmShutdown(sid = null, hostname = "Semua PC") {
    activeSid = sid;

    const actionSelect = document.getElementById('power-action-select');
    actionSelect.value = 'shutdown'; // Set default pilihan ke shutdown setiap kali modal dibuka

    // Fungsi update UI teks & deskripsi sesuai dengan opsi dropdown yang dipilih
    const updateModalText = () => {
        const action = actionSelect.value;
        const actionLabel = action === 'shutdown' ? 'Matikan' : 'Restart';

        document.getElementById('confirm-title').innerText = sid ? `${actionLabel} ${hostname}?` : `${actionLabel} Semua PC Lab?`;
        document.getElementById('confirm-desc').innerText = sid !== 'all'
            ? `Komputer ${hostname} akan di-${actionLabel.toLowerCase()} secara jarak jauh.`
            : `Seluruh komputer siswa yang terhubung akan di-${actionLabel.toLowerCase()} secara bersamaan.`;
        
        document.getElementById('btn-execute-text').innerText = `Ya, ${actionLabel}`;
    };

    // Daftarkan event listener saat pilihan dropdown diubah
    actionSelect.onchange = updateModalText;
    updateModalText(); // Jalankan sekali untuk inisialisasi awal

    // Jalankan eksekusi perintah saat tombol konfirmasi diklik
    const btnConfirm = document.getElementById('btn-execute-confirm');
    btnConfirm.onclick = () => {
        const selectedCommand = actionSelect.value; // 'shutdown' atau 'restart'
        sendDirectCommand(activeSid || 'all', selectedCommand);
        closeConfirmModal();
    };

    // Tampilkan Modal
    const modal = document.getElementById('confirm-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
    }, 10);
}

function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 200);
}