// ================================================================
// STATE SELEKSI & MULTISELECT MODE
// ================================================================
let isMultiSelectActive = false;

// 1. Toggle Mode Multiselect (Mengaktifkan/Mereset Opsi Bulatan)
function toggleMultiSelectMode() {
    isMultiSelectActive = !isMultiSelectActive;

    // Reset isi choosen_clients setiap kali tombol diklik/diklik ulang
    choosen_clients = [];

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

// 2. Pilih / Hapus Agent dari choosen_clients
function toggleAgentSelection(device_id) {
    const index = choosen_clients.indexOf(device_id);
    if (index > -1) {
        choosen_clients.splice(index, 1);
    } else {
        choosen_clients.push(device_id);
    }
    updateSelectionUI();
}

// 1. Fungsi Utama Evaluasi Kombinasi Filter (Room + Hostname)
function applyCardFilters() {
    const allCards = document.querySelectorAll('#student-grid > [id^="pc-"]');

    const searchKeyword = (activeSearchKeyword || '').toLowerCase().trim();
    const currentGroup = (activeGroup || '').toLowerCase().trim();
    console.log("Current Group Filter:", currentGroup);
    const currentStatus = (typeof activeStatusFilter !== 'undefined' ? activeStatusFilter : 'all');

    allCards.forEach(card => {
        const cardId = card.id.replace('pc-', '');
        const hostnameEl = card.querySelector('.hostname-text');
        const fullHostname = hostnameEl ? hostnameEl.innerText.toLowerCase().trim() : '';
        const groupPrefix = fullHostname.split('-')[0].trim();

        // Kriteria 1: Group Match
        const matchesGroup = !currentGroup || currentGroup === 'all' || groupPrefix === currentGroup;

        // Kriteria 2: Hostname Keyword Match
        const matchesSearch = searchKeyword === '' || fullHostname.includes(searchKeyword);

        // Kriteria 3: Status Online / Offline Match
        const isOnline = typeof connectedPcs !== 'undefined' && connectedPcs.has(cardId);
        const matchesStatus =
            currentStatus === 'all' ||
            (currentStatus === 'online' && isOnline) ||
            (currentStatus === 'offline' && !isOnline);

        if (matchesGroup && matchesSearch && matchesStatus) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });
}

// 2. Handler Klik Tombol Status (Desktop) & Dropdown Status (HP)
function setStatusFilter(status) {
    activeStatusFilter = status || 'all';

    // Sinkronkan Dropdown HP
    const mobileSelect = document.getElementById('mobile-status-select');
    if (mobileSelect && mobileSelect.value !== activeStatusFilter) {
        mobileSelect.value = activeStatusFilter;
    }

    const mobileDot = document.querySelector('#mobile-status-dot span');
    if (mobileDot) {
        mobileDot.className = 'w-2 h-2 rounded-full ' + (
            activeStatusFilter === 'online' ? 'bg-emerald-400 animate-pulse' :
            activeStatusFilter === 'offline' ? 'bg-rose-500' : 'bg-blue-400'
        );
    }

    // Nyalakan tombol filter yang aktif di Desktop
    const activeStyles = {
        all: ['bg-blue-950/60', 'border-blue-400', 'ring-1', 'ring-blue-400/50', 'shadow-lg', 'shadow-blue-950/40'],
        offline: ['bg-rose-950/60', 'border-rose-400', 'ring-1', 'ring-rose-400/50', 'shadow-lg', 'shadow-rose-950/40'],
        online: ['bg-emerald-950/60', 'border-emerald-400', 'ring-1', 'ring-emerald-400/50', 'shadow-lg', 'shadow-emerald-950/40']
    };

    const inactiveStyles = {
        all: ['bg-blue-950/20', 'border-blue-500/20', 'opacity-75', 'hover:opacity-100'],
        offline: ['bg-rose-950/20', 'border-rose-500/20', 'opacity-75', 'hover:opacity-100'],
        online: ['bg-emerald-950/20', 'border-emerald-500/20', 'opacity-75', 'hover:opacity-100']
    };

    document.querySelectorAll('.status-filter-btn').forEach(btn => {
        const btnType = btn.getAttribute('data-status-filter');
        const allPossible = [...activeStyles[btnType], ...inactiveStyles[btnType]];
        btn.classList.remove(...allPossible);

        if (btnType === activeStatusFilter) {
            btn.classList.add(...activeStyles[btnType]);
        } else {
            btn.classList.add(...inactiveStyles[btnType]);
        }
    });

    applyCardFilters();
}

// 2. Handler Input Search Hostname
function filterPcsByHostname(query) {
    activeSearchKeyword = (query || '').toLowerCase().trim();
    applyCardFilters();
}

// 3. Handler Switch Dropdown Group
function switchGroup(selectedGroup) {
    activeGroup = selectedGroup;
    applyCardFilters();
}

// 4. Perbarui Tampilan UI Kartu & Bulatan Seleksi
function updateSelectionUI() {
    const allCards = document.querySelectorAll('#student-grid > [id^="pc-"]');

    allCards.forEach(card => {
        const sid = card.id.replace('pc-', '');
        const isSelected = choosen_clients.includes(sid);
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