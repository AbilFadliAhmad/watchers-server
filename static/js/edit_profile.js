document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("edit-profile-modal")) {
        // Ambil data user dari variabel JavaScript global
        const currentUser = typeof user !== "undefined" ? user : { id: null, username: "", role: "dosen", room: "" };
        const isManagement = ["admin", "direktur", "developer"].includes(currentUser.role);

        // Ambil daftar rooms jika tersedia di JavaScript global, atau gunakan room milik user
        const roomList = (typeof rooms !== "undefined" && Array.isArray(rooms) && rooms.length > 0)
            ? rooms
            : [{ name: currentUser.room || "teachers" }];

        // HTML untuk pilihan Jabatan / Role
        const roleHtml = isManagement
            ? `
                <select id="profile-role" required class="w-full bg-gray-950 border border-gray-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-gray-100 focus:outline-none transition">
                    <option value="dosen" ${currentUser.role === "dosen" ? "selected" : ""}>Dosen</option>
                    <option value="admin" ${currentUser.role === "admin" ? "selected" : ""}>Admin</option>
                    <option value="direktur" ${currentUser.role === "direktur" ? "selected" : ""}>Direktur</option>
                    <option value="developer" ${currentUser.role === "developer" ? "selected" : ""}>Developer</option>
                </select>
            `
            : `
                <input type="text" value="${currentUser.role ? currentUser.role.toUpperCase() : ''}" disabled
                    class="w-full bg-gray-950/60 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-500 cursor-not-allowed capitalize">
            `;

        // Render Opsi Room
        const roomOptionsHtml = roomList.map(r => {
            const roomName = typeof r === "string" ? r : r.name;
            const isSelected = roomName === currentUser.room ? "selected" : "";
            return `<option value="${roomName}" ${isSelected}>${roomName}</option>`;
        }).join("");

        // HTML untuk pilihan Room Assignment
        const roomHtml = isManagement
            ? `
                <select id="profile-room" required class="w-full bg-gray-950 border border-gray-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-gray-100 focus:outline-none transition">
                    ${roomOptionsHtml}
                </select>
            `
            : `
                <select id="profile-room" disabled class="w-full bg-gray-950/60 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-500 cursor-not-allowed opacity-60">
                    <option value="${currentUser.room}" selected>${currentUser.room}</option>
                </select>
            `;

        // Buat elemen modal
        const modalElement = document.createElement("div");
        modalElement.id = "edit-profile-modal";
        modalElement.className = "fixed inset-0 bg-black/80 z-50 hidden items-center justify-center p-4";

        modalElement.innerHTML = `
            <div class="bg-gray-900 border border-gray-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
                <!-- Header Modal -->
                <div class="flex items-center justify-between pb-3 mb-4 border-b border-gray-800">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-xl bg-sky-600/20 border border-sky-500/30 text-sky-400 flex items-center justify-center">
                            <i data-lucide="user-cog" class="w-4 h-4"></i>
                        </div>
                        <h3 class="text-sm font-bold text-gray-100">Edit Profil Saya</h3>
                    </div>
                    <button onclick="closeEditProfileModal()" class="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <!-- Form Edit Profil -->
                <form onsubmit="submitEditProfile(event)" class="space-y-3">
                    <!-- Username -->
                    <div>
                        <label for="profile-username" class="block text-xs font-semibold text-gray-300 mb-1">Username</label>
                        <input type="text" id="profile-username" required value="${currentUser.username || ''}"
                            class="w-full bg-gray-950 border border-gray-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-gray-100 focus:outline-none transition">
                    </div>

                    <!-- Password -->
                    <div>
                        <label for="profile-password" class="block text-xs font-semibold text-gray-300 mb-1">
                            Sandi Baru <span class="text-[10px] text-gray-500 font-normal">(Kosongkan jika tidak diubah)</span>
                        </label>
                        <input type="password" id="profile-password" placeholder="••••••••"
                            class="w-full bg-gray-950 border border-gray-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-gray-100 focus:outline-none transition">
                    </div>

                    <!-- Jabatan / Role -->
                    ${isManagement ? `
                        <div>
                            <label for="profile-role" class="block text-xs font-semibold text-gray-300 mb-1">Jabatan / Role</label>
                            <select id="profile-role" required class="w-full bg-gray-950 border border-gray-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-gray-100 focus:outline-none transition">
                                <option value="dosen" ${currentUser.role === "dosen" ? "selected" : ""}>Dosen</option>
                                <option value="admin" ${currentUser.role === "admin" ? "selected" : ""}>Admin</option>
                                <option value="direktur" ${currentUser.role === "direktur" ? "selected" : ""}>Direktur</option>
                                <option value="developer" ${currentUser.role === "developer" ? "selected" : ""}>Developer</option>
                            </select>
                        </div>
                    ` : ""}


                    <!-- Room Assignment -->
                    ${isManagement ? `
                        <div>
                            <label for="profile-room" class="block text-xs font-semibold text-gray-300 mb-1">
                                Room Assignment
                            </label>
                            <select id="profile-room" required class="w-full bg-gray-950 border border-gray-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-gray-100 focus:outline-none transition">
                                ${roomOptionsHtml}
                            </select>
                        </div>
                    ` : ""}


                    <!-- Tombol Aksi -->
                    <div class="flex justify-end gap-2 pt-3">
                        <button type="button" onclick="closeEditProfileModal()" class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl transition">Batal</button>
                        <button type="submit" class="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl shadow-lg transition">Simpan Profil</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modalElement);

        if (typeof lucide !== "undefined") {
            lucide.createIcons();
        }
    }
});

function openEditProfileModal() {
    const modal = document.getElementById('edit-profile-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
}

function closeEditProfileModal() {
    const modal = document.getElementById('edit-profile-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function submitEditProfile(e) {
    e.preventDefault();
    const username = document.getElementById('profile-username').value;
    const password = document.getElementById('profile-password').value;
    const roleEl = document.getElementById('profile-role');
    const roomEl = document.getElementById('profile-room');

    const payload = {
        username: username,
        password: password || null,
        role: roleEl ? roleEl.value : undefined,
        room: roomEl ? roomEl.value : undefined
    };

    try {
        const response = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (response.ok) {
            if (typeof showToast === 'function') {
                showToast('Profil berhasil diperbarui!');
            }
            closeEditProfileModal();
            setTimeout(() => location.reload(), 1000);
        } else {
            if (typeof showToast === 'function') {
                showToast(result.detail || 'Gagal memperbarui profil', 'error');
            }
        }
    } catch (error) {
        if (typeof showToast === 'function') {
            showToast('Terjadi kesalahan koneksi', 'error');
        }
    }
}