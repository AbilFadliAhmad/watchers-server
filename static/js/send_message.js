document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("message-modal")) {
        // 1. Buat elemen div utama untuk modal
        const modalElement = document.createElement("div");

        // 2. Set ID dan class Tailwind
        modalElement.id = "message-modal";
        modalElement.className = "fixed inset-0 bg-black/70 z-50 flex items-center justify-center hidden opacity-0 transition-all duration-200";

        // 3. Isi struktur HTML di dalam elemen modal
        modalElement.innerHTML = `
            <div class="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-5 shadow-2xl transform scale-95 transition-all duration-200">
                <div class="flex justify-between items-center border-b border-gray-800 pb-3 mb-4">
                    <div class="flex items-center gap-2">
                        <i data-lucide="message-square" class="w-5 h-5 text-emerald-400"></i>
                        <h3 id="msg-modal-title" class="font-bold text-sm text-gray-100">Kirim Pesan ke Siswa</h3>
                    </div>
                    <button onclick="closeMessageModal()" class="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>
                <div class="space-y-3">
                    <label class="text-xs text-gray-400">Pesan Pengingat / Instruksi:</label>
                    <textarea id="msg-input" rows="3" class="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 transition resize-none" placeholder="Ketik pesan di sini..."></textarea>
                </div>
                <div class="mt-5 pt-3 border-t border-gray-800 flex justify-end gap-2">
                    <button onclick="closeMessageModal()" class="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold px-4 py-2 rounded-lg transition">Batal</button>
                    <button onclick="submitSendMessage()" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center gap-1.5">
                        <i data-lucide="send" class="w-3.5 h-3.5"></i> Kirim Pesan
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

function openMessageModal(sid, hostname) {
    activeSid = sid;
    document.getElementById('msg-modal-title').innerText = `Kirim Pesan ke ${hostname}`;

    setTimeout(() => {
        const msgInput = document.getElementById('msg-input');
        if (msgInput) {
            msgInput.value = '';
            msgInput.focus();
        }
    }, 50);

    const modal = document.getElementById('message-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
    }, 10);
}

function closeMessageModal() {
    const modal = document.getElementById('message-modal');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 200);
}

function submitSendMessage() {
    const text = document.getElementById('msg-input').value.trim();
    targetSid = activeSid || 'all';
    if (text) {
        sendDirectCommand(activeSid, 'message', { text: text });
        closeMessageModal();
    }
}