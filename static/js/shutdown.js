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