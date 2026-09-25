// ================================================================
// STATE SELEKSI HYBRID (PC & MOBILE)
// ================================================================
const selectedSids = new Set();
let lastSelectedSid = null;
let longPressTimer = null;
let isLongPressAction = false;
let startX = 0, startY = 0;

// 1. Fungsi Utama Toggle Seleksi Kartu
function toggleSelection(sid) {
    if (selectedSids.has(sid)) {
        selectedSids.delete(sid);
    } else {
        selectedSids.add(sid);
    }
    lastSelectedSid = sid;
    updateSelectionUI();
}

// 2. Handler Klik untuk Desktop (Shift + Click & Ctrl + Click)
function handleCardClick(e, sid) {
    // Jika event dipicu oleh lepas Long Press di HP, abaikan klik biasa
    if (isLongPressAction) {
        isLongPressAction = false;
        return;
    }

    const allCards = Array.from(document.querySelectorAll('#student-grid > [id^="pc-"]'));
    const currentIndex = allCards.findIndex(card => card.id === `pc-${sid}`);

    // Kasus 1: SHIFT + CLICK (Seleksi Rentang / Range Selection di PC)
    if (e.shiftKey && lastSelectedSid) {
        const lastIndex = allCards.findIndex(card => card.id === `pc-${lastSelectedSid}`);
        if (lastIndex !== -1 && currentIndex !== -1) {
            const start = Math.min(lastIndex, currentIndex);
            const end = Math.max(lastIndex, currentIndex);

            for (let i = start; i <= end; i++) {
                const cardSid = allCards[i].id.replace('pc-', '');
                selectedSids.add(cardSid);
            }
        }
    }
    // Kasus 2: CTRL / CMD + CLICK (Toggle Satu-Satu) ATAU jika Mode Seleksi Sedang Aktif
    else if (e.ctrlKey || e.metaKey || selectedSids.size > 0) {
        toggleSelection(sid);
    }
    // Kasus 3: Klik Biasa tanpa tombol kombinasi
    else {
        // Bebas: Buka detail PC atau fokus ke kartu
        console.log(`[+] Klik biasa pada PC: ${sid}`);
    }

    lastSelectedSid = sid;
    updateSelectionUI();
}

// 3. Handler Long Press untuk HP / Touchscreen
function handleTouchStart(e, sid) {
    isLongPressAction = false;
    const touch = e.touches ? e.touches[0] : e;
    startX = touch.clientX;
    startY = touch.clientY;

    longPressTimer = setTimeout(() => {
        isLongPressAction = true;
        toggleSelection(sid);

        // Haptic feedback (getaran singkat di HP jika didukung)
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }, 500); // Tahan selama 500ms (0.5 detik) untuk mentrigger Long Press
}

function handleTouchMove(e) {
    if (!longPressTimer) return;
    const touch = e.touches ? e.touches[0] : e;
    const diffX = Math.abs(touch.clientX - startX);
    const diffY = Math.abs(touch.clientY - startY);

    // Batalkan Long Press jika pengguna melakukan scroll/geser layar (>10px)
    if (diffX > 10 || diffY > 10) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
}

function handleTouchEnd() {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
}

// 4. Perbarui Tampilan UI (Border, Checkbox, & Floating Action Bar)
function updateSelectionUI() {
    const allCards = document.querySelectorAll('#student-grid > [id^="pc-"]');

    allCards.forEach(card => {
        const sid = card.id.replace('pc-', '');
        const isSelected = selectedSids.has(sid);
        const checkbox = card.querySelector('.select-checkbox');

        if (isSelected) {
            card.classList.add('ring-2', 'ring-indigo-500', 'bg-indigo-950/20', 'border-indigo-500/50');
            card.classList.remove('border-gray-800');
            if (checkbox) {
                checkbox.checked = true;
                checkbox.classList.remove('opacity-0');
            }
        } else {
            card.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-950/20', 'border-indigo-500/50');
            card.classList.add('border-gray-800');
            if (checkbox) {
                checkbox.checked = false;
                // Sembunyikan checkbox jika tidak ada yang dipilih sama sekali
                if (selectedSids.size === 0) {
                    checkbox.classList.add('opacity-0');
                }
            }
        }
    });

    // Perbarui Floating Bulk Action Bar
    const actionBar = document.getElementById('bulk-action-bar');
    const selectedCountText = document.getElementById('selected-count');

    if (actionBar && selectedCountText) {
        if (selectedSids.size > 0) {
            selectedCountText.innerText = `${selectedSids.size} PC Terpilih`;
            actionBar.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
        } else {
            actionBar.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
        }
    }
}

// 5. Batal Semua Seleksi
function clearAllSelections() {
    selectedSids.clear();
    lastSelectedSid = null;
    updateSelectionUI();
}

// 6. Pilih Semua PC Sekaligus
function selectAllPcs() {
    const allCards = document.querySelectorAll('#student-grid > [id^="pc-"]');
    allCards.forEach(card => {
        const sid = card.id.replace('pc-', '');
        selectedSids.add(sid);
    });
    updateSelectionUI();
}