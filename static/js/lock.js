document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("lock-modal")) {
        const modalElement = document.createElement("div");
        modalElement.id = "lock-modal";
        modalElement.className = "hidden fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4";

        modalElement.innerHTML = `
            <!-- Modal Input Kunci Layar -->
            <div class="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                
                <!-- Header -->
                <div class="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 shrink-0">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400">
                            <i data-lucide="lock" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="text-sm font-bold text-white">Kunci Layar Perangkat</h3>
                            <p class="text-[11px] text-gray-400">Atur mode kunci, target perangkat, dan kata sandi</p>
                        </div>
                    </div>
                    <button onclick="closeLockModal()" class="text-gray-400 hover:text-white transition p-1 rounded-lg hover:bg-gray-800">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <!-- Body -->
                <div class="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                    <input type="hidden" id="lock-target-sid">

                    <!-- Section 1: Mode Fokus atau Peringatan -->
                    <div>
                        <label class="text-xs font-semibold text-gray-300 block mb-1.5">Jenis Tindakan:</label>
                        <div class="grid grid-cols-2 gap-2.5">
                            <label class="cursor-pointer">
                                <input type="radio" name="lock-mode-type" value="focus" checked class="peer sr-only">
                                <div class="p-3 rounded-xl bg-gray-950 border border-gray-800 peer-checked:border-indigo-500 peer-checked:bg-indigo-950/30 transition">
                                    <div class="flex items-center gap-2 text-xs font-bold text-gray-200">
                                        <i data-lucide="eye" class="w-3.5 h-3.5 text-indigo-400"></i>
                                        <span>Mode Fokus</span>
                                    </div>
                                    <p class="text-[10px] text-gray-400 mt-1 leading-snug">Kunci layar tanpa catat pelanggaran</p>
                                </div>
                            </label>

                            <label class="cursor-pointer">
                                <input type="radio" name="lock-mode-type" value="warning" class="peer sr-only">
                                <div class="p-3 rounded-xl bg-gray-950 border border-gray-800 peer-checked:border-rose-500 peer-checked:bg-rose-950/30 transition">
                                    <div class="flex items-center gap-2 text-xs font-bold text-gray-200">
                                        <i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-rose-400"></i>
                                        <span>Peringatan</span>
                                    </div>
                                    <p class="text-[10px] text-gray-400 mt-1 leading-snug">Catat ke riwayat pelanggaran</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    <!-- Info Jika Menggunakan Mode Pilih Banyak PC -->
                    <div id="lock-multiselect-info" class="hidden p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-xs text-indigo-200 flex items-center gap-2">
                        <i data-lucide="check-circle-2" class="w-4 h-4 text-indigo-400 shrink-0"></i>
                        <span>Target menggunakan <strong id="lock-multiselect-count">0</strong> PC yang dipilih.</span>
                    </div>

                    <!-- Container Opsi Target Massal (Muncul saat targetSid === 'all' tanpa multiselect) -->
                    <div id="lock-bulk-options" class="hidden space-y-4">
                        <!-- Section 2: Status Target (Online Default vs Semua) -->
                        <div>
                            <label class="text-xs font-semibold text-gray-300 block mb-1.5">Status Perangkat Target:</label>
                            <div class="grid grid-cols-2 gap-2.5">
                                <label class="cursor-pointer">
                                    <input type="radio" name="lock-status-filter" value="online" checked class="peer sr-only">
                                    <div class="p-2.5 rounded-xl bg-gray-950 border border-gray-800 peer-checked:border-emerald-500 peer-checked:bg-emerald-950/30 transition flex items-center gap-2">
                                        <span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                                        <div>
                                            <span class="text-xs font-bold text-gray-200 block">Online Saja</span>
                                            <span class="text-[10px] text-gray-400">Default (PC aktif)</span>
                                        </div>
                                    </div>
                                </label>

                                <label class="cursor-pointer">
                                    <input type="radio" name="lock-status-filter" value="all" class="peer sr-only">
                                    <div class="p-2.5 rounded-xl bg-gray-950 border border-gray-800 peer-checked:border-blue-500 peer-checked:bg-blue-950/30 transition flex items-center gap-2">
                                        <span class="w-2 h-2 rounded-full bg-blue-400 shrink-0"></span>
                                        <div>
                                            <span class="text-xs font-bold text-gray-200 block">Semuanya</span>
                                            <span class="text-[10px] text-gray-400">Online & Offline</span>
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <!-- Section 3: Filter Group (Khusus Admin) -->
                        <div id="lock-admin-group-section" class="hidden">
                            <label for="lock-group-select" class="text-xs font-semibold text-gray-300 block mb-1.5">Pilih Group / Ruangan:</label>
                            <select id="lock-group-select" class="w-full bg-gray-950 border border-gray-800 text-xs text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-yellow-500">
                                <option value="all" selected>Semua Group</option>
                            </select>
                        </div>
                    </div>

                    <!-- Input Pesan Kunci -->
                    <div>
                        <label class="text-xs font-semibold text-gray-300 block mb-1.5">Pesan Tampilan Kunci:</label>
                        <input type="text" onkeydown="if(event.key === 'Enter') submitLockCommand();" id="lock-message-input" value="DIKUNCI OLEH GURU" placeholder="Masukkan pesan kunci..." class="w-full bg-gray-950 border border-gray-800 text-xs text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-yellow-500">
                    </div>

                    <!-- Input Kata Sandi Pembuka -->
                    <div>
                        <label class="text-xs font-semibold text-gray-300 block mb-1.5">Kata Sandi Pembuka (Opsional):</label>
                        <input type="password" onkeydown="if(event.key === 'Enter') submitLockCommand();" id="lock-password-input" placeholder="Kosongkan jika tanpa sandi" class="w-full bg-gray-950 border border-gray-800 text-xs text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-yellow-500">
                        <p class="text-[10px] text-gray-500 mt-1">Siswa dapat membuka kunci fisik PC sendiri jika memasukkan sandi ini.</p>
                    </div>
                </div>

                <!-- Footer -->
                <div class="px-6 py-4 border-t border-gray-800 bg-gray-900/50 flex justify-end gap-2.5 shrink-0">
                    <button onclick="closeLockModal()" class="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition">
                        Batal
                    </button>
                    <button onclick="submitLockCommand()" class="px-4 py-2 text-xs font-bold bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl shadow-lg transition flex items-center gap-2">
                        <i data-lucide="lock" class="w-3.5 h-3.5"></i>
                        Kunci Layar
                    </button>
                </div>

            </div>
        `;

        document.body.appendChild(modalElement);

        if (typeof lucide !== "undefined") {
            lucide.createIcons();
        }
    }
});

// Helper: Ambil daftar ID yang dipilih dari mode Pilih Banyak PC
function getActiveSelectedClients() {
    const selectedList =
        (typeof choosen_clients !== "undefined" && Array.isArray(choosen_clients)) ? choosen_clients :
        (typeof choose_clients !== "undefined" && Array.isArray(choose_clients)) ? choose_clients :
        (typeof choosen_agents !== "undefined" && Array.isArray(choosen_agents)) ? choosen_agents : [];

    const isChooseActive = (typeof isMultiSelectActive !== "undefined" && isMultiSelectActive) && selectedList.length > 0;
    return isChooseActive ? [...selectedList] : [];
}

// Helper: Isi dropdown Group khusus Admin dari variabel groups (fallback ke rooms)
function populateLockAdminGroups() {
    const adminSection = document.getElementById("lock-admin-group-section");
    const groupSelect = document.getElementById("lock-group-select");
    if (!adminSection || !groupSelect) return;

    const isAdmin = typeof user !== "undefined" && user && ["admin", "direktur", "developer"].includes(user.role);
    if (!isAdmin) {
        adminSection.classList.add("hidden");
        return;
    }

    adminSection.classList.remove("hidden");
    const sourceGroups =
        (typeof groups !== "undefined" && Array.isArray(groups)) ? groups :
        (typeof rooms !== "undefined" && Array.isArray(rooms)) ? rooms : [];

    groupSelect.innerHTML = `<option value="all" selected>Semua Group</option>`;
    sourceGroups.forEach(item => {
        const groupName = typeof item === "object" ? item.name : item;
        if (groupName && groupName.toLowerCase() !== "all") {
            const opt = document.createElement("option");
            opt.value = groupName;
            opt.textContent = groupName;
            groupSelect.appendChild(opt);
        }
    });
}

// Helper: Resolusi seluruh target menjadi Array IDs
function resolveLockTargetIds(targetSid) {
    if (targetSid !== "all") {
        return Array.isArray(targetSid) ? targetSid.map(String) : [String(targetSid)];
    }

    const selectedClients = getActiveSelectedClients();
    if (selectedClients.length > 0) {
        return selectedClients.map(String);
    }

    const statusFilter = document.querySelector('input[name="lock-status-filter"]:checked')?.value || "online";
    const isAdmin = typeof user !== "undefined" && user && ["admin", "direktur", "developer"].includes(user.role);
    const groupSelect = document.getElementById("lock-group-select");
    const selectedGroup = isAdmin
        ? (groupSelect ? groupSelect.value : "all")
        : (typeof activeRoom !== "undefined" && activeRoom ? activeRoom : (user?.room || "all"));

    const allClients = (typeof clients !== "undefined" && Array.isArray(clients))
        ? clients
        : Array.from(document.querySelectorAll('#student-grid > [id^="pc-"]')).map(card => ({
            id: card.id.replace("pc-", ""),
            name: card.querySelector(".hostname-text")?.innerText.trim() || ""
        }));

    const targetGroupLower = (selectedGroup || "all").toLowerCase().trim();

    return allClients
        .filter(client => {
            const clientId = String(client.id);
            const clientName = (client.name || "").toLowerCase().trim();
            const explicitGroup = (client.group || client.room || "").toLowerCase().trim();

            const matchesGroup =
                !targetGroupLower ||
                targetGroupLower === "all" ||
                (explicitGroup && explicitGroup === targetGroupLower) ||
                clientName === targetGroupLower ||
                clientName.startsWith(targetGroupLower + "-") ||
                clientName.split("-")[0].trim() === targetGroupLower;

            const isOnline = typeof connectedPcs !== "undefined" && connectedPcs.has(clientId);
            const matchesStatus = statusFilter === "all" || (statusFilter === "online" && isOnline);

            return matchesGroup && matchesStatus;
        })
        .map(client => String(client.id));
}

// Buka Modal Kunci
function openLockModal(targetSid) {
    if (!targetSid) {
        showToast("Target PC tidak valid!", "error");
        return;
    }

    document.getElementById("lock-target-sid").value = targetSid;
    document.getElementById("lock-message-input").value = "DIKUNCI OLEH GURU";
    document.getElementById("lock-password-input").value = "";

    // Reset default radio ke Mode Fokus & Status Online Saja
    const defaultModeRadio = document.querySelector('input[name="lock-mode-type"][value="focus"]');
    if (defaultModeRadio) defaultModeRadio.checked = true;

    const defaultStatusRadio = document.querySelector('input[name="lock-status-filter"][value="online"]');
    if (defaultStatusRadio) defaultStatusRadio.checked = true;

    const bulkOptionsEl = document.getElementById("lock-bulk-options");
    const multiselectInfoEl = document.getElementById("lock-multiselect-info");
    const selectedClients = getActiveSelectedClients();

    if (targetSid === "all") {
        if (selectedClients.length > 0) {
            bulkOptionsEl?.classList.add("hidden");
            multiselectInfoEl?.classList.remove("hidden");
            const countEl = document.getElementById("lock-multiselect-count");
            if (countEl) countEl.textContent = selectedClients.length;
        } else {
            multiselectInfoEl?.classList.add("hidden");
            bulkOptionsEl?.classList.remove("hidden");
            populateLockAdminGroups();
        }
    } else {
        bulkOptionsEl?.classList.add("hidden");
        multiselectInfoEl?.classList.add("hidden");
    }

    document.getElementById("lock-modal").classList.remove("hidden");

    setTimeout(() => {
        const passwordInput = document.getElementById("lock-password-input");
        if (passwordInput) {
            passwordInput.focus();
        }
    }, 50);
}

// Tutup Modal Kunci
function closeLockModal() {
    document.getElementById("lock-modal").classList.add("hidden");
}

// Kirim Perintah Lock dari Modal
function submitLockCommand() {
    const targetSid = document.getElementById("lock-target-sid").value;
    const message = document.getElementById("lock-message-input").value.trim() || "DIKUNCI OLEH GURU";
    const password = document.getElementById("lock-password-input").value.trim();

    // Ambil mode tindakan (Mode Fokus -> is_warning: false, Peringatan -> is_warning: true)
    const selectedMode = document.querySelector('input[name="lock-mode-type"]:checked')?.value || "focus";
    const isWarning = selectedMode === "warning";
    const modeLabel = isWarning ? "Peringatan" : "Mode Fokus";

    if (!targetSid) {
        showToast("Gagal: Identitas target PC tidak ditemukan!", "error");
        return;
    }

    const targetIds = resolveLockTargetIds(targetSid);

    if (!Array.isArray(targetIds) || targetIds.length === 0) {
        showToast("Tidak ada perangkat yang sesuai dengan filter target!", "error");
        return;
    }

    try {
        // Kirim targetIds berupa Array ID ke sendDirectCommand
        sendDirectCommand(targetIds, "lock", {
            log_details: `Perintah kunci layar (${modeLabel}) dikirim melalui panel manajemen. Pesan: "${message}"`,
            is_warning: isWarning,
            message: message,
            password: password
        });

        // Update Overlay UI untuk setiap ID target
        targetIds.forEach(id => {
            const card = document.getElementById(`pc-${id}`);
            if (card) {
                card.querySelector(".lock-overlay")?.classList.remove("hidden");
            }
        });

        showToast(`Perintah kunci layar (${modeLabel}) dikirim ke ${targetIds.length} PC!`, "success");
        closeLockModal();
    } catch (err) {
        console.error(err);
        showToast("Gagal mengirim perintah kunci layar!", "error");
    }
}