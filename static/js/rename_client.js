document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("rename-pc-modal")) {
        // 1. Buat elemen div utama untuk modal
        const modalElement = document.createElement("div");

        // 2. Set ID dan class Tailwind
        modalElement.id = "rename-pc-modal";
        modalElement.className = "hidden fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4";

        // 3. Isi struktur HTML di dalam elemen modal
        modalElement.innerHTML = `
            <!-- Modal Ubah Nama PC -->
            <div class="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                
                <!-- Header -->
                <div class="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                            <i data-lucide="edit-3" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="text-sm font-bold text-white">Ubah Nama PC</h3>
                            <p class="text-[11px] text-gray-400">Atur nama tampilan perangkat sesuai format lab</p>
                        </div>
                    </div>
                    <button onclick="closeRenameModal()" class="text-gray-400 hover:text-white transition p-1 rounded-lg hover:bg-gray-800">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <!-- Body -->
                <div class="p-6 space-y-4">
                    <input type="hidden" id="rename-device-id">

                    <!-- Input Nama -->
                    <div>
                        <label class="text-xs font-semibold text-gray-300 block mb-1.5">Nama Perangkat Baru:</label>
                        <input type="text" id="rename-hostname-input" placeholder="Contoh: LAB1-PC05" class="w-full bg-gray-950 border border-gray-800 text-xs text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-amber-500 font-mono">
                    </div>

                    <!-- Kotak Petunjuk / Panduan Format untuk Orang Awam -->
                    <div class="bg-gray-950/80 border border-amber-500/20 rounded-xl p-3.5 space-y-2">
                        <div class="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                            <i data-lucide="info" class="w-4 h-4 shrink-0"></i>
                            <span>Aturan Format: <code class="bg-amber-950/80 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 font-mono">{Group}-{Siswa}</code></span>
                        </div>
                        
                        <p class="text-[11px] text-gray-300 leading-relaxed pl-6">
                            Gunakan <strong>tanda strip/minus (-)</strong> sebagai pemisah antara nama ruangan/kelompok dan nama komputer/siswa.
                        </p>

                        <div class="pl-6 pt-1 border-t border-gray-800/60 text-[11px] text-gray-400 space-y-1">
                            <p class="text-gray-300 font-medium">💡 Contoh Pengisian:</p>
                            <ul class="space-y-1 font-mono text-[10px] text-gray-300">
                                <li class="flex items-center gap-2">
                                    <span class="text-amber-400">LAB1-PC05</span>
                                    <span class="text-gray-500 font-sans text-[10px]">(Lab 1, Komputer Nomor 05)</span>
                                </li>
                                <li class="flex items-center gap-2">
                                    <span class="text-amber-400">R2-BUDI</span>
                                    <span class="text-gray-500 font-sans text-[10px]">(Ruang 2, Siswa bernama Budi)</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="px-6 py-4 border-t border-gray-800 bg-gray-900/50 flex justify-end gap-2.5">
                    <button onclick="closeRenameModal()" class="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition">
                        Batal
                    </button>
                    <button onclick="submitRenamePC()" class="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-xl shadow-lg transition flex items-center gap-2">
                        <i data-lucide="save" class="w-3.5 h-3.5"></i>
                        Simpan Nama
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

function openRenameModal(deviceId, currentHostname) {
    document.getElementById('rename-device-id').value = deviceId;
    document.getElementById('rename-pc-modal').classList.remove('hidden');
    
    setTimeout(() => {
        const inputField = document.getElementById('rename-hostname-input');
        if (inputField) {
            inputField.value = document.querySelector(`#pc-${deviceId} .hostname-text`).textContent || currentHostname || '';
            inputField.focus();
            inputField.select();
            inputField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    submitRenamePC();
                }
            });
        }
    }, 50); 
}

// Tutup Modal Rename
function closeRenameModal() {
    document.getElementById('rename-pc-modal').classList.add('hidden');
}

// Kirim Perubahan ke Server via REST API
async function submitRenamePC() {
    const deviceId = document.getElementById('rename-device-id').value;
    const newName = document.getElementById('rename-hostname-input').value.trim();

    if (!newName) {
        showToast("Nama PC tidak boleh kosong!");
        return;
    }

    try {
        const response = await fetch('/api/clients/rename', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id: deviceId, new_name: newName })
        });

        if (response.ok) {
            showToast("Nama PC berhasil diperbarui!");
            closeRenameModal();

            // Update nama secara langsung di UI lokal tanpa refresh
            const hostnameSpan = document.querySelector(`#pc-${deviceId} .hostname-text`);
            if (hostnameSpan) {
                hostnameSpan.textContent = newName;
            }
        } else {
            const err = await response.json();
            showToast("Gagal memperbarui: " + (err.detail || "Terjadi kesalahan"));
        }
    } catch (e) {
        console.error(e);
        showToast("Gagal terhubung ke server.");
    }
}
