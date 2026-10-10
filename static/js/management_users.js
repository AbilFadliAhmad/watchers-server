document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("ota-modal")) {
        // 1. Buat elemen div utama untuk modal
        const modalElement = document.createElement("div");

        // 2. Set ID dan class Tailwind
        modalElement.id = "ota-modal";
        modalElement.className = "fixed inset-0 bg-black/70 z-50 flex items-center justify-center hidden opacity-0 transition-all duration-200";

        // 3. Isi struktur HTML di dalam elemen modal
        modalElement.innerHTML = `
            <div class="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-5 shadow-2xl transform scale-95 transition-all duration-200">
                <div class="flex justify-between items-center border-b border-gray-800 pb-3 mb-4">
                    <div class="flex items-center gap-2">
                        <i data-lucide="refresh-cw" class="w-5 h-5 text-indigo-400"></i>
                        <h3 class="font-bold text-sm text-gray-100">Update Client Application (.exe)</h3>
                    </div>
                    <button onclick="closeOtaModal()" class="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>

                <div class="space-y-4">
                    <p class="text-xs text-gray-400">Pilih file executable (<code class="text-indigo-300">.exe</code>) build terbaru. File akan diunggah ke folder static server dan tautan unduhannya disiarkan ke seluruh PC client.</p>

                    <input type="file" id="ota-file-input" accept=".exe" class="block w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600/20 file:text-indigo-300 hover:file:bg-indigo-600 hover:file:text-white cursor-pointer bg-gray-950 border border-gray-800 rounded-xl p-2 transition">

                    <!-- Indikator Loading Upload -->
                    <div id="ota-status" class="text-xs text-indigo-400 hidden flex items-center gap-2">
                        <i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>
                        <span id="ota-status-text">Mengunggah file ke server...</span>
                    </div>
                </div>

                <div class="mt-5 pt-3 border-t border-gray-800 flex justify-end gap-2">
                    <button onclick="closeOtaModal()" class="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold px-4 py-2 rounded-lg transition">Batal</button>
                    <button onclick="submitOtaUpdate()" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center gap-1.5">
                        <i data-lucide="upload-cloud" class="w-3.5 h-3.5"></i> Upload & Broadcast
                    </button>
                </div>
            </div>
        `;

        // 4. Tambahkan node elemen ke dokumen HTML menggunakan appendChild
        document.body.appendChild(modalElement);

        // Render ulang ikon Lucide jika digunakan
        if (typeof lucide !== "undefined") {
            lucide.createIcons();
        }
    }
});

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

