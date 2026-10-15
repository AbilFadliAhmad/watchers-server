// ================================================================
// STATE SELEKSI & MULTISELECT MODE
// ================================================================
let choosen_agents = []; // Variabel penampung SID/PC terpilih
let isMultiSelectActive = false;

// 1. Toggle Mode Multiselect (Mengaktifkan/Mereset Opsi Bulatan)
function toggleMultiSelectMode() {
    isMultiSelectActive = !isMultiSelectActive;

    // Reset isi choosen_agents setiap kali tombol diklik/diklik ulang
    choosen_agents = [];

    const btn = document.getElementById('toggle-multiselect-btn');
    const btnText = document.getElementById('multiselect-btn-text');

    if (isMultiSelectActive) {
        btn?.classList.add('bg-indigo-950/60', 'border-indigo-600/60', 'text-indigo-300');
        if (btnText) btnText.innerText = 'Batal Pilih';
    } else {
        btn?.classList.remove('bg-indigo-950/60', 'border-indigo-600/60', 'text-indigo-300');
        if (btnText) btnText.innerText = 'Pilih Banyak PC';
    }

    updateSelectionUI();
}

// 2. Pilih / Hapus Agent dari choosen_agents
function toggleAgentSelection(sid) {
    const index = choosen_agents.indexOf(sid);
    if (index > -1) {
        choosen_agents.splice(index, 1);
    } else {
        choosen_agents.push(sid);
    }
    updateSelectionUI();
    console.log('[+] choosen_agents terkini:', choosen_agents);
}

// 3. Filter PC berdasarkan Input Search Bar Hostname
function filterPcsByHostname(query) {
    const keyword = query.toLowerCase().trim();
    const allCards = document.querySelectorAll('#student-grid > [id^="pc-"]');

    allCards.forEach(card => {
        const hostnameEl = card.querySelector('.hostname-text');
        const hostname = hostnameEl ? hostnameEl.innerText.toLowerCase() : '';

        if (hostname.includes(keyword)) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });
}

// 4. Perbarui Tampilan UI Kartu & Bulatan Seleksi
function updateSelectionUI() {
    const allCards = document.querySelectorAll('#student-grid > [id^="pc-"]');

    allCards.forEach(card => {
        const sid = card.id.replace('pc-', '');
        const isSelected = choosen_agents.includes(sid);
        let circleBtn = card.querySelector('.select-bullet-btn');

        // Tambah bulatan di atas kartu jika belum ada
        if (!circleBtn) {
            circleBtn = document.createElement('button');
            circleBtn.className = 'select-bullet-btn absolute top-3 left-3 z-40 w-5 h-5 rounded-full border-2 border-indigo-400/80 bg-gray-950/80 flex items-center justify-center transition hover:scale-110';
            circleBtn.onclick = (e) => {
                e.stopPropagation();
                toggleAgentSelection(sid);
            };
            card.style.position = 'relative';
            card.appendChild(circleBtn);
        }

         // Style bulatan jika terpilih
        if (isSelected) {
            circleBtn.className = 'select-bullet-btn absolute top-3 left-3 z-40 w-5 h-5 rounded-full border-2 border-indigo-500 bg-indigo-600 text-white flex items-center justify-center transition shadow-lg scale-110';
            circleBtn.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i>';
            card.classList.add('ring-2', 'ring-indigo-500', 'bg-indigo-950/20');
        } else {
            circleBtn.className = 'select-bullet-btn absolute top-3 left-3 z-40 w-5 h-5 rounded-full border-2 border-indigo-500 bg-gray-900/80 flex items-center justify-center transition';
            circleBtn.innerHTML = '';
            card.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-950/20');
        }

        // Tampilkan/sembunyikan bulatan berdasarkan mode multiselect
        if (isMultiSelectActive) {
            circleBtn.classList.remove('hidden');
        } else {
            circleBtn.classList.add('hidden');
        }
    });

    if (window.lucide) lucide.createIcons();
}