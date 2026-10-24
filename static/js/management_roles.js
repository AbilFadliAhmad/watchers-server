document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("role-modal")) {
        const modalElement = document.createElement("div");
        modalElement.id = "role-modal";
        modalElement.className = "fixed inset-0 bg-black/80 z-50 hidden items-center justify-center p-4";

        modalElement.innerHTML = `
            <div class="bg-gray-900 border border-gray-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
                <!-- Header Modal -->
                <div class="flex items-center justify-between pb-3 border-b border-gray-800">
                    <div class="flex items-center gap-2.5">
                        <div class="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center">
                            <i data-lucide="shield" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="text-sm font-bold text-gray-100">Manajemen Role & Jabatan</h3>
                            <p class="text-[11px] text-gray-400">Tambah dan lihat daftar tingkatan role pengguna</p>
                        </div>
                    </div>
                    <button onclick="closeRoleModal()" class="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <!-- Form Tambah Role Baru -->
                <form onsubmit="submitCreateRole(event)" class="mt-4 space-y-3">
                    <div>
                        <label for="role-name-input" class="block text-xs font-semibold text-gray-300 mb-1">Nama Role Baru</label>
                        <div class="flex gap-2">
                            <input type="text" id="role-name-input" required placeholder="Contoh: asisten_lab"
                                class="flex-1 bg-gray-950 border border-gray-800 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs text-gray-100 placeholder-gray-600 focus:outline-none transition">
                            <button type="submit" class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-lg shadow-purple-600/20 transition cursor-pointer">
                                <i data-lucide="plus" class="w-4 h-4"></i> Tambah
                            </button>
                        </div>
                    </div>
                </form>

                <!-- List Role Terdaftar -->
                <div class="mt-4 pt-3 border-t border-gray-800 flex-1 overflow-hidden flex flex-col">
                    <div class="flex justify-between items-center mb-2">
                        <p class="text-xs font-semibold text-gray-400">Daftar Role Terdaftar</p>
                        <span id="role-count-badge" class="text-[10px] font-mono text-purple-400 bg-purple-950/60 border border-purple-800/50 px-2 py-0.5 rounded-full">0 Role</span>
                    </div>
                    <div id="role-list-container" class="overflow-y-auto space-y-2 pr-1 custom-scrollbar flex-1">
                        <p class="text-xs text-gray-500 text-center py-4">Memuat data role...</p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modalElement);
        if (typeof lucide !== "undefined") lucide.createIcons();
    }
});

// Buka & Tutup Modal
function openRoleModal() {
    const modal = document.getElementById("role-modal");
    if (modal) {
        modal.classList.remove("hidden");
        modal.classList.add("flex");
    }
    const dropdown = document.getElementById("profile-dropdown");
    if (dropdown) dropdown.classList.add("hidden");

    loadRolesFromGlobal();
}

function closeRoleModal() {
    const modal = document.getElementById("role-modal");
    if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    }
}

// Membaca langsung dari variabel global 'roles'
function loadRolesFromGlobal() {
    const badge = document.getElementById("role-count-badge");

    if (badge) badge.innerText = `${roles.length} Role`;
    renderRoleList();
}

function renderRoleList() {
    const container = document.getElementById("role-list-container");

    if (!roles || roles.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-500 text-center py-4">Belum ada role terdaftar.</p>`;
        return;
    }

    container.innerHTML = roles.map(r => {
        const roleName = typeof r === "string" ? r : r.name;
        const isAdmin = roleName.toLowerCase() === "admin";

        return `
            <div class="flex items-center justify-between bg-gray-950 border border-gray-800 p-2.5 rounded-xl">
                <div class="flex items-center gap-2.5">
                    <i data-lucide="shield-check" class="w-4 h-4 text-purple-400"></i>
                    <span class="text-xs font-semibold text-gray-200 uppercase">${roleName}</span>
                </div>
                <div>
                    ${
                        isAdmin
                        ? `<span class="text-[10px] font-mono text-gray-500 px-2 py-0.5 bg-gray-900 border border-gray-800 rounded-md">Bawaan Sistem</span>`
                        : `<button onclick="deleteRole('${roleName}')" class="p-1 text-gray-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition" title="Hapus Role">
                               <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                           </button>`
                    }
                </div>
            </div>
        `;
    }).join("");

    if (typeof lucide !== "undefined") lucide.createIcons();
}

// Tambah Role Baru (Update array global secara langsung)
async function submitCreateRole(e) {
    e.preventDefault();
    const input = document.getElementById("role-name-input");
    const roleName = input.value.trim().toLowerCase();

    if (!roleName) return;

    try {
        const response = await fetch("/api/roles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: roleName })
        });
        const result = await response.json();

        if (response.ok) {
            if (typeof showToast === "function") showToast(`Role '${roleName}' berhasil ditambahkan!`);

            const newRoleObj = result.data || { id: Date.now(), name: roleName };
            if (typeof roles !== "undefined" && Array.isArray(roles)) {
                roles.push(newRoleObj);
            }

            input.value = "";
            window.location.reload();
        } else {
            if (typeof showToast === "function") showToast(result.detail || "Gagal menambah role", "error");
        }
    } catch (error) {
        if (typeof showToast === "function") showToast("Terjadi kesalahan jaringan", "error");
    }
}

// Hapus Role (Update array global secara langsung)
async function deleteRole(roleName) {
    if (typeof showConfirmToast === "function") {
        const isConfirmed = await showConfirmToast(`Apakah Anda yakin ingin menghapus role '${roleName}'?`, "warning");
        if (!isConfirmed) return;
    }

    try {
        const response = await fetch(`/api/roles/${encodeURIComponent(roleName)}`, {
            method: "DELETE"
        });
        const result = await response.json();

        if (response.ok) {
            if (typeof showToast === "function") showToast(`Role '${roleName}' berhasil dihapus!`);

            if (typeof roles !== "undefined" && Array.isArray(roles)) {
                const index = roles.findIndex(r => (typeof r === "string" ? r : r.name) === roleName);
                if (index !== -1) roles.splice(index, 1);
            }

            window.location.reload();
        } else {
            if (typeof showToast === "function") showToast(result.detail || "Gagal menghapus role", "error");
        }
    } catch (error) {
        if (typeof showToast === "function") showToast("Terjadi kesalahan jaringan", "error");
    }
}