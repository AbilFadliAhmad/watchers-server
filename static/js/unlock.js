function unlockScreen(targetSid) {
    if (!targetSid) {
        showToast("Gagal: Identitas target PC tidak valid!", 'error');
        return;
    }

    try {
        sendDirectCommand(targetSid, 'unlock', {
            log_details: "Perintah buka kunci layar dikirim melalui panel manajemen.",
            is_warning: false
        });

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
