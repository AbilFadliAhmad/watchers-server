let isLoading = true;
const connectedPcs = new Set();


// 1. Fungsi Menampilkan Skeleton Cards (Default 6 Kartu)
function showSkeletons(count = 6) {
    const grid = document.getElementById("student-grid");
    grid.innerHTML = ""; // Bersihkan container

    for (let i = 0; i < count; i++) {
        const skeleton = document.createElement("div");
        skeleton.className = "skeleton-card bg-gray-900 rounded-xl p-4 border border-gray-800/60 shadow-xl flex flex-col justify-between animate-pulse";
        skeleton.innerHTML = `
            <div>
                <!-- Header Skeleton -->
                <div class="flex justify-between items-center mb-3">
                    <div class="h-4 w-28 bg-gray-800 rounded-md"></div>
                    <div class="h-5 w-24 bg-gray-800 rounded-full"></div>
                </div>
                <!-- Preview Screen Skeleton -->
                <div class="w-full h-40 bg-gray-800 rounded-lg mb-3"></div>
            </div>
            <!-- Tombol Action Skeleton -->
            <div class="flex flex-col gap-2 mt-2">
                <div class="h-8 w-full bg-gray-800 rounded-lg"></div>
                <div class="h-8 w-full bg-gray-800 rounded-lg"></div>
            </div>
        `;
        grid.appendChild(skeleton);
    }
}

// 2. Fungsi Menampilkan State "Belum Ada Komputer Terhubung"
function showEmptyState() {
    const grid = document.getElementById("student-grid");

    // Hanya tampilkan jika benar-benar tidak ada PC yang terhubung
    if (connectedPcs.size === 0) {
        grid.innerHTML = `
            <div id="empty-state" class="col-span-full py-16 flex flex-col items-center justify-center text-center bg-gray-900/40 rounded-2xl border border-dashed border-gray-800 p-8 my-4">
                <div class="w-16 h-16 bg-indigo-950/60 border border-indigo-800/40 rounded-full flex items-center justify-center mb-4 text-indigo-400 shadow-inner">
                    <i data-lucide="monitor-off" class="w-8 h-8"></i>
                </div>
                <h3 class="text-base font-semibold text-gray-200 mb-1">Belum Ada Komputer Terhubung</h3>
                <p class="text-xs text-gray-400 max-w-sm mb-4">Pastikan aplikasi client agent di komputer siswa sudah aktif dan terhubung ke jaringan laboratorium.</p>
                <div class="flex items-center gap-2 text-[11px] text-gray-400 bg-gray-950 px-3.5 py-1.5 rounded-full border border-gray-800 shadow-sm">
                    <span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                    Menunggu koneksi dari komputer siswa...
                </div>
            </div>
        `;
        lucide.createIcons();
    }
}

// 3. Fungsi Membersihkan Skeleton atau Empty State saat PC Pertama Terhubung
function clearPlaceholders() {
    // Hapus seluruh skeleton card jika masih ada
    document.querySelectorAll('.skeleton-card').forEach(el => el.remove());

    // Hapus pesan empty state jika ada
    const emptyState = document.getElementById('empty-state');
    if (emptyState) {
        emptyState.remove();
    }
}

// 4. Inisialisasi Skeleton Saat Halaman Pertama Kali Diumat
document.addEventListener("DOMContentLoaded", () => {
    // Tampilkan skeleton terlebih dahulu
    showSkeletons(6);

    // Setelah 4 detik (4000 ms)
    setTimeout(() => {
        isLoading = false;

        // Bersihkan skeleton yang tersisa
        document.querySelectorAll('.skeleton-card').forEach(el => el.remove());

        // Jika sampai 4 detik belum ada PC yang terhubung, tampilkan empty state
        if (connectedPcs.size === 0) {
            showEmptyState();
        }
    }, 4000);
});