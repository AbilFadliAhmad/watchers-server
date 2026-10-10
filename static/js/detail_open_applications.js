document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("app-modal")) {
        // 1. Buat elemen div utama untuk modal
        const modalElement = document.createElement("div");

        // 2. Set ID dan class Tailwind
        modalElement.id = "app-modal";
        modalElement.className = "fixed inset-0 bg-black/80 z-50 flex items-center justify-center hidden opacity-0 transition-all duration-200";

        // 3. Isi struktur HTML di dalam elemen modal
        modalElement.innerHTML = `
            <div class="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-5 shadow-2xl transform scale-95 transition-all duration-200">

                <!-- Header Modal -->
                <div class="flex justify-between items-center border-b border-gray-800 pb-3 mb-4">
                    <div class="flex items-center gap-2">
                        <i data-lucide="layout-grid" class="w-5 h-5 text-indigo-400"></i>
                        <h3 id="modal-title" class="font-bold text-sm text-gray-100">Daftar Aplikasi Aktif</h3>
                    </div>
                    <button onclick="closeAppModal()" class="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>

                <!-- Body Modal (Daftar Aplikasi) -->
                <div id="modal-app-list" class="space-y-2 max-h-64 overflow-y-auto pr-1">
                    <!-- Item aplikasi dirender dinamis di sini -->
                </div>

                <!-- Footer Modal -->
                <div class="mt-5 pt-3 border-t border-gray-800 flex justify-end">
                    <button onclick="closeAppModal()" class="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold px-4 py-2 rounded-lg transition">
                        Tutup
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


// Buka Modal & Render Daftar Aplikasi
function showAppDetails(sid, hostname) {
    const apps = activeAppsData[sid] || [];
    const modal = document.getElementById('app-modal');
    const modalCard = modal.querySelector('div');
    const modalTitle = document.getElementById('modal-title');
    const modalAppList = document.getElementById('modal-app-list');

    modalTitle.innerText = `Aplikasi Aktif - ${hostname}`;

    if (apps.length === 0) {
        modalAppList.innerHTML = `
            <div class="text-center py-6 text-gray-500 text-xs flex flex-col items-center gap-2">
                <i data-lucide="info" class="w-6 h-6 text-gray-600"></i>
                <span>Tidak ada aplikasi aktif yang terdeteksi.</span>
            </div>
        `;
    } else {
        // Daftar aplikasi sistem yang ingin diabaikan (lowercase untuk pencocokan aman)
        const ignoredApps = ['settings', 'windows input experience', 'program manager'];
        // Filter aplikasi terlebih dahulu
        const filteredApps = apps.filter(app => !ignoredApps.includes(app.toLowerCase().trim()));
        modalAppList.innerHTML = filteredApps.map((app, index) => `
            <div class="flex items-center gap-3 bg-gray-950 border border-gray-800/80 p-2.5 rounded-xl">
                <span class="text-[11px] font-mono font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-800/50 w-6 h-6 rounded-lg flex items-center justify-center shrink-0">
                    ${index + 1}
                </span>
                <span class="text-xs text-gray-200 truncate font-medium">${app}</span>
            </div>
        `).join('');
    }

    lucide.createIcons();

    // Efek Transisi Membuka Modal
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalCard.classList.remove('scale-95');
    }, 10);
}

// Tutup Modal dengan Transisi Smooth
function closeAppModal() {
    const modal = document.getElementById('app-modal');
    const modalCard = modal.querySelector('div');

    modal.classList.add('opacity-0');
    modalCard.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

// Event Listener: Tutup saat area luar modal diklik atau menekan tombol ESC
document.getElementById('app-modal').addEventListener('click', (e) => {
    if (e.target.id === 'app-modal') closeAppModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAppModal();
});