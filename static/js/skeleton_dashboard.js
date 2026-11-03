let isLoading = true;
const connectedPcs = new Set();

// Helper untuk mengontrol visibilitas Live Status Panel
function toggleLiveStatusPanel(visible) {
    const liveStatusPanel = document.getElementById("live-status-panel");
    if (!liveStatusPanel) return;

    if (visible) {
        liveStatusPanel.classList.remove("hidden");
        liveStatusPanel.classList.add("lg:block");
    } else {
        liveStatusPanel.classList.add("hidden");
        liveStatusPanel.classList.remove("lg:block");
    }
}

// 1. Fungsi Menampilkan Skeleton Cards (Default 6 Kartu)
function showSkeletons(count = 6) {
    const grid = document.getElementById("student-grid");

    for (let i = 0; i < count; i++) {
        const skeleton = document.createElement("div");
        skeleton.className = "skeleton-card bg-gray-900 rounded-xl p-4 border border-gray-800/60 shadow-xl flex flex-col justify-between animate-pulse";
        skeleton.innerHTML = `
            <div>
                <div class="flex justify-between items-center mb-3">
                    <div class="h-4 w-28 bg-gray-800 rounded-md"></div>
                    <div class="h-5 w-24 bg-gray-800 rounded-full"></div>
                </div>
                <div class="w-full h-40 bg-gray-800 rounded-lg mb-3"></div>
            </div>
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

    if (connectedPcs.size === 0) {
        // Sembunyikan panel Live Status saat state kosong
        toggleLiveStatusPanel(false);

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
    document.querySelectorAll('.skeleton-card').forEach(el => el.remove());

    const emptyState = document.getElementById('empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    // Tampilkan kembali panel Live Status jika ada PC terhubung
    if (connectedPcs.size > 0) {
        toggleLiveStatusPanel(true);
    }
}

// 4. Inisialisasi Skeleton Saat Halaman Pertama Kali Dimuat
document.addEventListener("DOMContentLoaded", () => {
    // Sembunyikan Live Status sementara saat masih skeleton/loading awal jika belum ada PC
    if (connectedPcs.size === 0) {
        toggleLiveStatusPanel(false);
    }

    showSkeletons(6);

    setTimeout(() => {
        isLoading = false;
        document.querySelectorAll('.skeleton-card').forEach(el => el.remove());

        if (connectedPcs.size === 0) {
            showEmptyState();
        } else {
            toggleLiveStatusPanel(true);
        }
    }, 1000);
});