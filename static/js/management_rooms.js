// --- MODAL ATUR ROOM (GROUP) ---
function openGroupModal() {
    const modal = document.getElementById('room-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) lucide.createIcons();
}

function closeGroupModal() {
    const modal = document.getElementById('room-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function submitCreateRoom(event) {
    event.preventDefault();
    const nameInput = document.getElementById('room-name-input');
    const roomName = nameInput.value.trim();

    try {
        const response = await fetch('/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: roomName })
        });

        const data = await response.json();

        if (response.ok) {
            showToast(`✅ Room '${roomName}' berhasil dibuat!`);
            nameInput.value = '';
            setTimeout(() => window.location.reload(), 1000); // Reload untuk memperbarui UI
        } else {
            showToast(`⚠️ ${data.detail || 'Gagal membuat room'}`, 'error');
        }
    } catch (error) {
        showToast('❌ Gagal terhubung ke server', 'error');
        console.error(error);
    }
}

// --- HAPUS ROOM ---
async function deleteRoom(roomId, roomName) {
    if (!confirm(`Apakah Anda yakin ingin menghapus room '${roomName}'?`)) return;

    try {
        const response = await fetch(`/api/rooms/${roomId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok) {
            showToast(`✅ Room '${roomName}' berhasil dihapus!`);
            setTimeout(() => window.location.reload(), 800);
        } else {
            showToast(`⚠️ ${data.detail || 'Gagal menghapus room'}`, 'error');
        }
    } catch (error) {
        showToast('❌ Gagal terhubung ke server', 'error');
        console.error(error);
    }
}

// --- HANDLER EDIT ROOM ---
function openEditRoomModal(id, currentName) {
    document.getElementById('edit-room-id').value = id;
    document.getElementById('edit-room-name').value = currentName;
    const modal = document.getElementById('edit-room-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) lucide.createIcons();
}

function closeEditRoomModal() {
    const modal = document.getElementById('edit-room-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function submitEditRoom(event) {
    event.preventDefault();
    const id = document.getElementById('edit-room-id').value;
    const newName = document.getElementById('edit-room-name').value.trim();

    try {
        const response = await fetch(`/api/rooms/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
        });
        const data = await response.json();

        if (response.ok) {
            showToast(`✅ Room berhasil diperbarui!`);
            closeEditRoomModal();
            setTimeout(() => window.location.reload(), 800);
        } else {
            showToast(`⚠️ ${data.detail || 'Gagal mengubah room'}`, 'error');
        }
    } catch (error) {
        showToast('❌ Gagal terhubung ke server', 'error');
    }
}