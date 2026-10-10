function unlockScreen(targetSid) {
    if (!targetSid) {
        showToast("Gagal: Identitas target PC tidak valid!", 'error');
        return;
    }

    try {
        const payload = {
            target_sid: targetSid,
            command: { action: 'unlock' }
        };

        const socketConn = (typeof sio !== 'undefined' && sio.connected) ? sio : (typeof socket !== 'undefined' && socket.connected ? socket : null);
        if (socketConn) socketConn.emit("send_command", payload);

        // Update Overlay UI Secara Aman
        if (targetSid === 'all') {
            document.querySelectorAll('.lock-overlay').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.spinner-overlay').forEach(el => el.classList.remove('hidden'));
        } else {
            const card = document.getElementById(`pc-${targetSid}`);
            if (card) {
                card.querySelector('.lock-overlay')?.classList.add('hidden');
                card.querySelector('.spinner-overlay')?.classList.remove('hidden');
            }
        }

        showToast("Kunci layar berhasil dibuka!", 'success');
    } catch (err) {
        console.error(err);
        showToast("Gagal mengirim perintah buka kunci!", 'error');
    }
}        // Buka Modal Rename
