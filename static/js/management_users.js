// --- Create Staff (USERS) ---
function openStaffModal() {
    const modal = document.getElementById('staff-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) lucide.createIcons();
}
function closeStaffModal() {
    const modal = document.getElementById('staff-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}
async function submitCreateUser(event) {
    event.preventDefault();
    const username = document.getElementById('staff-username').value.trim();
    const password = document.getElementById('staff-password').value;
    const role = document.getElementById('staff-role').value;
    const room = document.getElementById('staff-room').value;

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role, room })
        });

        const data = await response.json();

        if (response.ok) {
            showToast(`✅ User '${username}' (${role}) berhasil didaftarkan!`);
            document.getElementById('staff-username').value = '';
            document.getElementById('staff-password').value = '';
            setTimeout(() => window.location.reload(), 1000); // Reload untuk memperbarui UI
        } else {
            showToast(`⚠️ ${data.detail || 'Gagal membuat user'}`, 'error');
        }
    } catch (error) {
        showToast('❌ Gagal terhubung ke server', 'error');
        console.error(error);
    }
}

// --- Edit Staff (USERS) ---
function openEditUserModal(id, username, role, room) {
    document.getElementById('edit-staff-id').value = id;
    document.getElementById('edit-staff-username').value = username;
    document.getElementById('edit-staff-password').value = ''; // Reset input password
    document.getElementById('edit-staff-role').value = role;
    document.getElementById('edit-staff-room').value = room;

    const modal = document.getElementById('edit-staff-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) lucide.createIcons();
}
function closeEditUserModal() {
    const modal = document.getElementById('edit-staff-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}
async function submitEditUser(event) {
    event.preventDefault();
    const id = document.getElementById('edit-staff-id').value;
    const username = document.getElementById('edit-staff-username').value.trim();
    const password = document.getElementById('edit-staff-password').value;
    const role = document.getElementById('edit-staff-role').value;
    const room = document.getElementById('edit-staff-room').value;

    const payload = { username, role, room };
    if (password && password.trim() !== '') {
        payload.password = password;
    }

    try {
        const response = await fetch(`/api/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (response.ok) {
            showToast(`✅ Data user berhasil diperbarui!`);
            closeEditUserModal();
            setTimeout(() => window.location.reload(), 800);
        } else {
            showToast(`⚠️ ${data.detail || 'Gagal mengedit user'}`, 'error');
        }
    } catch (error) {
        showToast('❌ Gagal terhubung ke server', 'error');
    }
}

// --- Delete Staff (USERS) ---
async function deleteUser(userId, username) {
    if (!confirm(`Apakah Anda yakin ingin menghapus user '${username}'?`)) return;

    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok) {
            showToast(`✅ User '${username}' berhasil dihapus!`);
            setTimeout(() => window.location.reload(), 800);
        } else {
            showToast(`⚠️ ${data.detail || 'Gagal menghapus user'}`, 'error');
        }
    } catch (error) {
        showToast('❌ Gagal terhubung ke server', 'error');
        console.error(error);
    }
}

