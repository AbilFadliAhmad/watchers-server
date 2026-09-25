// Membuka Modal Kunjungi URL
function openUrlModal(sid = 'all', hostname = 'Semua PC') {
    activeSid = sid;
    activeHostname = hostname;

    const modal = document.getElementById('url-modal');
    const label = document.getElementById('url-target-label');
    const input = document.getElementById('input-target-url');

    label.innerText = `Target: ${hostname}`;
    input.value = ''; // Reset input

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