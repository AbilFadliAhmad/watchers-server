document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("lock-modal")) {
        // 1. Buat elemen div utama untuk modal
        const modalElement = document.createElement("div");

        // 2. Set ID dan class Tailwind
        modalElement.id = "lock-modal";
        modalElement.className = "hidden fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4";

        // 3. Isi struktur HTML di dalam elemen modal
        modalElement.innerHTML = `
            <!-- Modal Input Kunci Layar -->
            <div class="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                
                <!-- Header -->
                <div class="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400">
                            <i data-lucide="lock" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="text-sm font-bold text-white">Kunci Layar Perangkat</h3>
                            <p class="text-[11px] text-gray-400">Atur pesan tampilan dan kata sandi pembuka</p>
                        </div>
                    </div>
                    <button onclick="closeLockModal()" class="text-gray-400 hover:text-white transition p-1 rounded-lg hover:bg-gray-800">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <!-- Body -->
                <div class="p-6 space-y-4">
                    <input type="hidden" id="lock-target-sid">

                    <div>
                        <label class="text-xs font-semibold text-gray-300 block mb-1.5">Pesan Tampilan Kunci:</label>
                        <input type="text" id="lock-message-input" value="DIKUNCI OLEH GURU" placeholder="Masukkan pesan kunci..." class="w-full bg-gray-950 border border-gray-800 text-xs text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-yellow-500">
                    </div>

                    <div>
                        <label class="text-xs font-semibold text-gray-300 block mb-1.5">Kata Sandi Pembuka (Opsional):</label>
                        <input type="password" id="lock-password-input" placeholder="Kosongkan jika tanpa sandi" class="w-full bg-gray-950 border border-gray-800 text-xs text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-yellow-500">
                        <p class="text-[10px] text-gray-500 mt-1">Siswa dapat membuka kunci fisik PC sendiri jika memasukkan sandi ini.</p>
                    </div>
                </div>

                <!-- Footer -->
                <div class="px-6 py-4 border-t border-gray-800 bg-gray-900/50 flex justify-end gap-2.5">
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

        // 4. Tambahkan node elemen ke dokumen HTML menggunakan appendChild
        document.body.appendChild(modalElement);

        // Render ulang ikon Lucide jika digunakan
        if (typeof lucide !== "undefined") {
            lucide.createIcons();
        }
    }
});


// Buka Modal Kunci
function openLockModal(targetSid) {
    console.log("Membuka modal kunci untuk SID:", targetSid);
    if (!targetSid) {
        showToast("Target PC tidak valid!", 'error');
        return;
    }
    document.getElementById('lock-target-sid').value = targetSid;
    document.getElementById('lock-message-input').value = "DIKUNCI OLEH GURU";
    document.getElementById('lock-password-input').value = "";
    document.getElementById('lock-modal').classList.remove('hidden');

    // 2. Beri jeda singkat agar DOM/animasi selesai diproses, lalu fokuskan input
    setTimeout(() => {
        const passwordInput = document.getElementById('lock-password-input');
        if (passwordInput) {
            passwordInput.focus();
            passwordInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    submitLockCommand();
                }
            });
        }
    }, 50);
}

// Tutup Modal Kunci
function closeLockModal() {
    document.getElementById('lock-modal').classList.add('hidden');
}

// Kirim Perintah Lock dari Modal
function submitLockCommand() {
    const targetSid = document.getElementById('lock-target-sid').value;
    const message = document.getElementById('lock-message-input').value.trim() || "DIKUNCI OLEH GURU";
    const password = document.getElementById('lock-password-input').value.trim();

    if (!targetSid) {
        showToast("Gagal: Identitas target PC tidak ditemukan!", 'error');
        return;
    }

    try {
        const payload = {
            target_sid: targetSid,
            command: {
                action: 'lock',
                message: message,
                password: password
            }
        };

        const socketConn = (typeof sio !== 'undefined' && sio.connected) ? sio : (typeof socket !== 'undefined' && socket.connected ? socket : null);
        if (socketConn) socketConn.emit("send_command", payload);

        // Update Overlay UI Secara Aman
        if (targetSid === 'all') {
            document.querySelectorAll('.lock-overlay').forEach(el => el.classList.remove('hidden'));
        } else {
            const card = document.getElementById(`pc-${targetSid}`);
            if (card) {
                card.querySelector('.lock-overlay')?.classList.remove('hidden');
            }
        }

        showToast("Perintah kunci layar berhasil dikirim!", 'success');
        closeLockModal();
    } catch (err) {
        console.error(err);
        showToast("Gagal mengirim perintah kunci layar!", 'error');
    }
}
