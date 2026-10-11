// --- TOAST NOTIFICATION HELPER (BIASA & KONFIRMASI) ---

// 1. Toast Notifikasi Biasa
function showToast(message, type = 'success') {
    const isSuccess = type === 'success';
    Toastify({
        text: message,
        duration: 3500,
        gravity: "top",
        position: "right",
        style: {
            background: isSuccess ? "#064e3b" : "#881337",
            color: isSuccess ? "#6ee7b7" : "#fda4af",
            border: `1px solid ${isSuccess ? "#047857" : "#be123c"}`,
            borderRadius: "0.75rem",
            fontSize: "12px",
            fontWeight: "600"
        }
    }).showToast();
}

// 2. Toast Konfirmasi Tombol Interaktif
function showConfirmToast(message, type = 'danger') {
    return new Promise((resolve) => {
        const themes = {
            danger: {
                bg: "#881337", border: "#be123c", text: "#fda4af",
                btnConfirm: "bg-rose-600 hover:bg-rose-500 text-white",
                btnCancel: "bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80"
            },
            warning: {
                bg: "#78350f", border: "#b45309", text: "#fde68a",
                btnConfirm: "bg-amber-600 hover:bg-amber-500 text-white",
                btnCancel: "bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800/80"
            },
            info: {
                bg: "#1e1b4b", border: "#4338ca", text: "#c7d2fe",
                btnConfirm: "bg-indigo-600 hover:bg-indigo-500 text-white",
                btnCancel: "bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/80"
            },
            success: {
                bg: "#064e3b", border: "#047857", text: "#6ee7b7",
                btnConfirm: "bg-emerald-600 hover:bg-emerald-500 text-white",
                btnCancel: "bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/80"
            }
        };

        const theme = themes[type] || themes.danger;

        const container = document.createElement("div");
        container.className = "flex flex-col gap-2.5 p-0.5 min-w-[220px]";

        const textEl = document.createElement("div");
        textEl.className = "font-semibold text-xs leading-relaxed";
        textEl.innerText = message;
        container.appendChild(textEl);

        const btnContainer = document.createElement("div");
        btnContainer.className = "flex items-center justify-end gap-2 mt-1";

        const btnCancel = document.createElement("button");
        btnCancel.className = `px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${theme.btnCancel}`;
        btnCancel.innerText = "Batal";

        const btnConfirm = document.createElement("button");
        btnConfirm.className = `px-3 py-1.5 rounded-lg text-[11px] font-bold transition shadow-md cursor-pointer ${theme.btnConfirm}`;
        btnConfirm.innerText = "Ya, Lanjutkan";

        btnContainer.appendChild(btnCancel);
        btnContainer.appendChild(btnConfirm);
        container.appendChild(btnContainer);

        const toast = Toastify({
            node: container,
            duration: -1,
            gravity: "top",
            position: "right",
            close: false,
            style: {
                background: theme.bg,
                color: theme.text,
                border: `1px solid ${theme.border}`,
                borderRadius: "0.75rem",
                padding: "12px 16px",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)"
            }
        });

        // Resolve boolean sesuai tombol yang diklik
        btnCancel.addEventListener("click", () => {
            toast.hideToast();
            resolve(false);
        });

        btnConfirm.addEventListener("click", () => {
            toast.hideToast();
            resolve(true);
        });

        toast.showToast();
    });
}