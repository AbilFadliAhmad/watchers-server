function confirmShutdown(sid = null, hostname = "Semua PC") {
    activeSid = sid;

    document.getElementById('confirm-title').innerText = sid ? `Matikan ${hostname}?` : "Matikan Semua PC Lab?";
    document.getElementById('confirm-desc').innerText = sid
        ? `Komputer ${hostname} akan dimatikan secara paksa.`
        : "Seluruh komputer siswa yang terhubung akan dimatikan secara bersamaan.";

    const btnConfirm = document.getElementById('btn-execute-confirm');
    btnConfirm.onclick = () => {
        if (activeSid) {
            sendDirectCommand(activeSid, 'shutdown');
        } else {
            broadcastCommand('shutdown');
        }
        closeConfirmModal();
    };

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