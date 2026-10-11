// ================================================================
// TAHAP 1: PEMBUATAN STRUKTUR MODAL & DROPZONE AREA
// ================================================================
document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("ota-modal")) {
        const modalElement = document.createElement("div");
        modalElement.id = "ota-modal";
        modalElement.className = "fixed inset-0 bg-black/70 z-50 flex items-center justify-center hidden opacity-0 transition-all duration-200";

        modalElement.innerHTML = `
            <div class="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl transform scale-95 transition-all duration-200 flex flex-col max-h-[90vh]">
                <!-- Header Modal -->
                <div class="flex justify-between items-center border-b border-gray-800 pb-3 mb-4 shrink-0">
                    <div class="flex items-center gap-2">
                        <i data-lucide="refresh-cw" class="w-5 h-5 text-indigo-400"></i>
                        <h3 class="font-bold text-sm text-gray-100">Manajemen & Update Client (.exe)</h3>
                    </div>
                    <button onclick="closeOtaModal()" class="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>

                <div class="space-y-4 overflow-y-auto pr-1 custom-scrollbar flex-1">
                    <!-- Dropzone Area -->
                    <div id="ota-dropzone" onclick="document.getElementById('ota-file-input').click()"
                         class="border-2 border-dashed border-gray-700 hover:border-indigo-500 bg-gray-950/60 rounded-xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group">
                        <div class="p-3 bg-indigo-500/10 text-indigo-400 rounded-full group-hover:scale-110 transition-transform">
                            <i data-lucide="upload-cloud" class="w-6 h-6"></i>
                        </div>
                        <div>
                            <p class="text-xs font-semibold text-gray-200">Klik atau seret file <code class="text-indigo-400">.exe</code> ke sini</p>
                            <p class="text-[11px] text-gray-500">Hanya menerima installer executable (.exe)</p>
                        </div>
                        <input type="file" id="ota-file-input" accept=".exe" class="hidden">
                    </div>

                    <!-- Status Loading Upload -->
                    <div id="ota-upload-status" class="hidden p-3 bg-indigo-950/40 border border-indigo-800/50 rounded-xl text-xs text-indigo-300 flex items-center justify-between">
                        <div class="flex items-center gap-2.5">
                            <i data-lucide="loader-2" class="w-4 h-4 animate-spin text-indigo-400"></i>
                            <span id="ota-status-text">Mengunggah file ke server...</span>
                        </div>
                        <span id="ota-upload-percent" class="font-mono text-indigo-400 font-bold">0%</span>
                    </div>

                    <!-- Header & Container List Agent -->
                    <div>
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-xs font-semibold text-gray-300">Pilih Versi Agent untuk Broadcast</span>
                            <span id="agent-count-badge" class="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-800/50 px-2 py-0.5 rounded-full">0 File</span>
                        </div>
                        <div id="agent-list-container" class="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            <p class="text-xs text-gray-500 text-center py-4">Memuat daftar installer...</p>
                        </div>
                    </div>
                </div>

                <!-- Footer Action Buttons -->
                <div class="mt-4 pt-3 border-t border-gray-800 flex justify-end gap-2 shrink-0">
                    <button onclick="closeOtaModal()" class="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold px-4 py-2 rounded-lg transition">Batal</button>
                    <button id="btn-broadcast-update" disabled onclick="submitSelectedOtaUpdate()" 
                            class="bg-gray-800 text-gray-500 text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center gap-1.5 cursor-not-allowed">
                        <i data-lucide="send" class="w-3.5 h-3.5"></i> Broadcast Update
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

let selectedAgent = null;

// Inisialisasi Event Listener saat DOM Siap
document.addEventListener("DOMContentLoaded", () => {
    initOtaDropzone();
});

// 1. Inisialisasi Area Drag & Drop
function initOtaDropzone() {
    const dropzone = document.getElementById("ota-dropzone");
    const fileInput = document.getElementById("ota-file-input");

    if (!dropzone || !fileInput) return;

    ["dragenter", "dragover"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add("border-indigo-500", "bg-indigo-950/20");
        });
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove("border-indigo-500", "bg-indigo-950/20");
        });
    });

    dropzone.addEventListener("drop", (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFileSelection(files[0]);
    });

    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) handleFileSelection(e.target.files[0]);
    });
}

// 2. Menghitung SHA-256 File di Browser
async function calculateClientSHA256(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// 3. Validasi & Proses Upload File .exe secara Chunked dari Browser
async function handleFileSelection(file) {

    // 1. Validasi Ekstensi File
    if (!file.name.endsWith(".exe")) {
        showToast("Harap pilih file executable dengan ekstensi .exe!", "error");
        return;
    }

    // Regex ketat: Harus diawali WatchersAgent-v, diikuti versi (X.Y.Z), arsitektur (x64/x86/arm64), dan ekstensi .exe
    const watcherFilenameRegex = /^WatchersAgent-v\d+\.\d+\.\d+-(x64|x86|arm64)\.exe$/i;

    // 2. Validasi Ketat Nama File (Format, Versi, dan Arsitektur/Bit)
    if (!watcherFilenameRegex.test(file.name)) {
        showToast(
            "Format nama file tidak valid! Harus sesuai pola 'WatchersAgent-vX.Y.Z-x64.exe' (contoh: WatchersAgent-v1.3.0-x64.exe) tanpa karakter tambahan.", 
            "error"
        );
        return;
    }

    const statusContainer = document.getElementById("ota-upload-status");
    const statusText = document.getElementById("ota-status-text");
    const percentText = document.getElementById("ota-upload-percent");

    statusContainer.classList.remove("hidden");
    statusText.innerText = "Menghitung SHA-256 lokal...";
    percentText.innerText = "0%";

    try {
        // Hitung Hash SHA-256 penuh di browser sebelum dipotong
        const clientSha256 = await calculateClientSHA256(file);

        // Ukuran per chunk: 512 KB
        const CHUNK_SIZE = 512000;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        let uploadResult = null;
        const startDate = Date.now(); // Timestamp unik

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(file.size, start + CHUNK_SIZE);
            const chunk = file.slice(start, end);

            const formData = new FormData();
            formData.append("chunk", chunk);
            formData.append("filename", file.name);
            formData.append("chunk_index", chunkIndex);
            formData.append("total_chunks", totalChunks);
            formData.append("client_sha256", clientSha256);
            formData.append("start_date", startDate); // Kirim timestamp pembuatan/awal upload

            statusText.innerText = `Mengunggah bagian ${chunkIndex + 1} dari ${totalChunks}...`;
            const response = await fetch("/api/upload-installer-chunk", {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                const errorJson = await response.json().catch(() => ({}));
                throw new Error(errorJson.detail || `Gagal mengunggah chunk ke-${chunkIndex + 1}`);
            }

            uploadResult = await response.json();

            // Hitung dan tampilkan persentase progres
            const progressPercent = Math.round(((chunkIndex + 1) / totalChunks) * 100);
            percentText.innerText = `${progressPercent}%`;
        }

        statusText.innerText = "Upload & Verifikasi SHA-256 Berhasil!";
        percentText.innerText = "100%";

        // Perbarui daftar installer di tampilan UI
        if (uploadResult && uploadResult.data) {
            const newInstaller = uploadResult.data;
            agentLists = agentLists.filter(a => a.name !== newInstaller.name);
            agentLists.unshift(newInstaller);
            renderAgentLists();
        } 

        setTimeout(() => {
            statusContainer.classList.add("hidden");
        }, 1500);

    } catch (error) {
        console.error("Upload Gagal:", error);
        showToast(`Upload Gagal: ${error.message}`, "error");
        statusContainer.classList.add("hidden");
    }
}

// 5. Render Elemen List Installer
function renderAgentLists() {
    const container = document.getElementById("agent-list-container");

    if (!agentLists || agentLists.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-500 text-center py-4">Belum ada file installer di server. Silakan upload terlebih dahulu.</p>`;
        return;
    }

    container.innerHTML = agentLists.map((agent, index) => {
        const isSelected = selectedAgent && selectedAgent.url === agent.url;
        return `
            <div onclick="selectAgent(${index})" 
                 class="p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                     isSelected 
                     ? "bg-indigo-950/60 border-indigo-500 text-gray-100" 
                     : "bg-gray-950/80 border-gray-800 hover:border-gray-700 text-gray-300"
                 }">
                <div class="flex items-center gap-3 overflow-hidden mr-2">
                    <div class="p-2 rounded-lg ${isSelected ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400"}">
                        <i data-lucide="file-code-2" class="w-4 h-4"></i>
                    </div>
                    <div class="overflow-hidden">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-xs truncate">${agent.name}</span>
                            <span class="text-[10px] font-mono px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded">v${agent.version}</span>
                        </div>
                        <p class="text-[10px] text-gray-500 font-mono truncate">SHA: ${agent.sha256}</p>
                    </div>
                </div>
                <div class="shrink-0">
                    <input type="radio" name="selected_agent" ${isSelected ? "checked" : ""} class="accent-indigo-500 pointer-events-none">
                </div>
            </div>
        `;
    }).join("");

    if (typeof lucide !== "undefined") lucide.createIcons();
}

// 6. Pilih Agent & Aktifkan Tombol Broadcast
function selectAgent(index) {
    selectedAgent = agentLists[index];
    renderAgentLists();

    const btnBroadcast = document.getElementById("btn-broadcast-update");
    if (selectedAgent && btnBroadcast) {
        btnBroadcast.disabled = false;
        btnBroadcast.className = "bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/30";
    }
}

// 7. Buka Modal & Load Data
function openOtaModal() {
    const modal = document.getElementById("ota-modal");
    selectedAgent = null;

    const btnBroadcast = document.getElementById("btn-broadcast-update");
    if (btnBroadcast) {
        btnBroadcast.disabled = true;
        btnBroadcast.className = "bg-gray-800 text-gray-500 text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center gap-1.5 cursor-not-allowed";
    }

    modal.classList.remove("hidden");
    setTimeout(() => {
        modal.classList.remove("opacity-0");
        modal.querySelector("div").classList.remove("scale-95");
    }, 10);

    const badge = document.getElementById("agent-count-badge");
    badge.innerText = `${agentLists.length} File`;
    renderAgentLists();
}

function closeOtaModal() {
    const modal = document.getElementById("ota-modal");
    modal.classList.add("opacity-0");
    modal.querySelector("div").classList.add("scale-95");
    setTimeout(() => modal.classList.add("hidden"), 200);
}

// 8. Kirim Perintah Broadcast OTA ke Client
async function submitSelectedOtaUpdate() {
    if (!selectedAgent) {
        showToast("Pilih salah satu versi installer terlebih dahulu!", "error");
        return;
    }

    // Digunakan persis seperti confirm native
    const isConfirmed = await showConfirmToast(
        `Siarkan perintah update versi v${selectedAgent.version} (${selectedAgent.name}) ke seluruh PC client?`,
        "info"
    );

    if (!isConfirmed) return;

    try {
        // Kirim HTTP POST ke endpoint backend FastAPI pengganti socket.emit
        const response = await fetch("/api/select-installer", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: selectedAgent.name,
                version: selectedAgent.version,
                url: selectedAgent.url,
                sha256: selectedAgent.sha256
            })
        });

        const result = await response.json();

        if (response.ok) {
            closeOtaModal();
            showToast(`🚀 OTA Update (v${selectedAgent.version}) berhasil dipilih & disiarkan!`);
        } else {
            showToast(`⚠️ ${result.detail || result.message || 'Gagal memilih versi'}`, 'error');
        }

    } catch (error) {
        showToast('❌ Terjadi kesalahan jaringan saat memilih versi installer.', 'error');
        console.error(error);
    }
}