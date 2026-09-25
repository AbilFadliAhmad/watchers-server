function openMessageModal(sid, hostname) {
    activeSid = sid;
    document.getElementById('msg-modal-title').innerText = `Kirim Pesan ke ${hostname}`;
    document.getElementById('msg-input').value = '';

    const modal = document.getElementById('message-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
    }, 10);
}

function closeMessageModal() {
    const modal = document.getElementById('message-modal');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 200);
}

function submitSendMessage() {
    const text = document.getElementById('msg-input').value.trim();
    targetSid = activeSid || 'all';
    if (text) {
        sendDirectCommand(activeSid, 'message', { text: text });
        closeMessageModal();
    }
}