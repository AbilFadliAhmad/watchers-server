document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("unlock-modal")) {
        const modalElement = document.createElement("div");
        modalElement.id = "unlock-modal";
        modalElement.className = "hidden fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4";

        modalElement.innerHTML = `
            <!-- Modal Konfirmasi Buka Kunci Massal -->
            <div class="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                
                <!-- Header -->
                <div class="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 shrink-0">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                            <i data-lucide="unlock" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="text-sm font-bold text-white">Buka Kunci Layar Perangkat</h3>
                            <p class="text-[11px] text-gray-400">Pilih target perangkat yang akan dibuka kuncinya</p>
                        </div>
                    </div>
                    <button onclick="closeUnlockModal()" class="text-gray-400 hover:text-white transition p-1 rounded-lg hover:bg-gray-800">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <!-- Body -->
                <div class="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                    <!-- Section 1: Status Target (Online Default vs Semua) -->
                    <div>
                        <label class="text-xs font-semibold text-gray-300 block mb-1.5">Status Perangkat Target:</label>
                        <div class="grid grid-cols-2 gap-2.5">
                            <label class="cursor-pointer">
                                <input type="radio" name="unlock-status-filter" value="online" checked class="peer sr-only">
                                <div class="p-2.5 rounded-xl bg-gray-950 border border-gray-800 peer-checked:border-emerald-500 peer-checked:bg-emerald-950/30 transition flex items-center gap-2">
                                    <span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                                    <div>
                                        <span class="text-xs font-bold text-gray-200 block">Online Saja</span>
                                        <span class="text-[10px] text-gray-400">Default (PC aktif)</span>
                                    </div>
                                </div>
                            </label>

                            <label class="cursor-pointer">
                                <input type="radio" name="unlock-status-filter" value="all" class="peer sr-only">
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

                    <!-- Section 2: Filter Group (Khusus Admin) -->
                    <div id="unlock-admin-group-section" class="hidden">
                        <label for="unlock-group-select" class="text-xs font-semibold text-gray-300 block mb-1.5">Pilih Group / Ruangan:</label>
                        <select id="unlock-group-select" class="w-full bg-gray-950 border border-gray-800 text-xs text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-emerald-500">
                            <option value="all" selected>Semua Group</option>
                        </select>
                    </div>
                </div>

                <!-- Footer -->
                <div class="px-6 py-4 border-t border-gray-800 bg-gray-900/50 flex justify-end gap-2.5 shrink-0">
                    <button onclick="closeUnlockModal()" class="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition">
                        Batal
                    </button>
                    <button onclick="submitUnlockCommand()" class="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg transition flex items-center gap-2">
                        <i data-lucide="unlock" class="w-3.5 h-3.5"></i>
                        Buka Kunci
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
function getUnlockSelectedClients() {
    const selectedList =
        (typeof choosen_clients !== "undefined" && Array.isArray(choosen_clients)) ? choosen_clients :
        (typeof choose_clients !== "undefined" && Array.isArray(choose_clients)) ? choose_clients :
        (typeof choosen_agents !== "undefined" && Array.isArray(choosen_agents)) ? choosen_agents : [];

    const isChooseActive = (typeof isMultiSelectActive !== "undefined" && isMultiSelectActive) && selectedList.length > 0;
    return isChooseActive ? [...selectedList] : [];
}

// Helper: Isi dropdown Group khusus Admin dari variabel groups (fallback ke rooms)
function populateUnlockAdminGroups() {
    const adminSection = document.getElementById("unlock-admin-group-section");
    const groupSelect = document.getElementById("unlock-group-select");
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

// Helper: Resolusi seluruh target menjadi Array IDs berdasarkan status & group
function resolveUnlockTargetIds() {
    const statusFilter = document.querySelector('input[name="unlock-status-filter"]:checked')?.value || "online";
    const isAdmin = typeof user !== "undefined" && user && ["admin", "direktur", "developer"].includes(user.role);
    const groupSelect = document.getElementById("unlock-group-select");
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

// Eksekusi pengiriman array IDs dan pembaruan UI kartu
function executeUnlockTargets(targetIds) {
    if (!Array.isArray(targetIds) || targetIds.length === 0) {
        showToast("Tidak ada perangkat yang sesuai dengan filter target!", "error");
        return false;
    }

    try {
        sendDirectCommand(targetIds, "unlock", {
            log_details: "Perintah buka kunci layar dikirim melalui panel manajemen.",
            is_warning: false
        });

        targetIds.forEach(id => {
            const card = document.getElementById(`pc-${id}`);
            if (card) {
                card.querySelector(".lock-overlay")?.classList.add("hidden");
                if (typeof connectedPcs !== "undefined" && connectedPcs.has(String(id))) {
                    card.querySelector(".spinner-overlay")?.classList.remove("hidden");
                }
            }
        });

        showToast(`Kunci layar berhasil dibuka untuk ${targetIds.length} PC!`, "success");
        return true;
    } catch (err) {
        console.error(err);
        showToast("Gagal mengirim perintah buka kunci!", "error");
        return false;
    }
}

// Entry point tombol Buka Kunci (satuan maupun tombol massal 'all')
function unlockScreen(targetSid) {
    if (!targetSid) {
        showToast("Gagal: Identitas target PC tidak valid!", "error");
        return;
    }

    // Jika target satuan, langsung kirim sebagai array [targetSid]
    if (targetSid !== "all") {
        const ids = Array.isArray(targetSid) ? targetSid.map(String) : [String(targetSid)];
        executeUnlockTargets(ids);
        return;
    }

    // Jika 'all' dan mode Pilih Banyak PC aktif, langsung gunakan PC yang dicentang
    const selectedClients = getUnlockSelectedClients();
    if (selectedClients.length > 0) {
        executeUnlockTargets(selectedClients.map(String));
        return;
    }

    // Jika 'all' tanpa pilihan multiselect, buka modal opsi Status & Group
    const defaultStatusRadio = document.querySelector('input[name="unlock-status-filter"][value="online"]');
    if (defaultStatusRadio) defaultStatusRadio.checked = true;

    populateUnlockAdminGroups();
    document.getElementById("unlock-modal")?.classList.remove("hidden");
}

function closeUnlockModal() {
    document.getElementById("unlock-modal")?.classList.add("hidden");
}

function submitUnlockCommand() {
    const targetIds = resolveUnlockTargetIds();
    if (executeUnlockTargets(targetIds)) {
        closeUnlockModal();
    }
}