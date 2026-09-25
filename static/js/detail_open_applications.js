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