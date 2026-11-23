// Ikon SVG statis ultra-ringan (menghindari pemindaian DOM penuh oleh lucide.createIcons)
const EXPLORER_ICONS = {
  drive: `<svg class="w-4 h-4 text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/></svg>`,
  folder: `<svg class="w-4 h-4 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>`,
  file: `<svg class="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`,
  chevron: `<svg class="w-3.5 h-3.5 text-gray-600 group-hover:text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>`,
  alert: `<svg class="w-6 h-6 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
};

let explorerState = {
  targetId: "",
  pcName: "",
  currentPath: "ROOT",
  parentPath: null,
};

// Cache referensi DOM modal agar tidak perlu getElementById berulang kali
let explorerDom = null;

function ensureExplorerModal() {
  if (explorerDom) return explorerDom;

  let modal = document.getElementById("directoryExplorerModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "directoryExplorerModal";
    // Hapus backdrop-blur-sm agar GPU tidak berat merender ulang grid layar siswa di belakang modal
    modal.className = "fixed inset-0 z-50 hidden items-center justify-center bg-black/80 p-4";

    modal.innerHTML = `
      <div class="w-full max-w-3xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div class="px-5 py-4 bg-gray-950 border-b border-gray-800 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0">
              ${EXPLORER_ICONS.drive}
            </div>
            <div class="min-w-0">
              <h3 class="text-sm font-bold text-white truncate">
                File Explorer — <span id="explorerPcName" class="text-cyan-400">PC</span>
              </h3>
              <p class="text-[11px] text-gray-400 truncate">Audit struktur folder & kapasitas penyimpanan (Read-Only)</p>
            </div>
          </div>
          <button type="button" id="btnCloseExplorer" class="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div class="px-5 py-2.5 bg-gray-900 border-b border-gray-800 flex items-center gap-2">
          <button type="button" id="btnExplorerRoot" title="Daftar Drive" class="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium flex items-center gap-1.5 transition shrink-0">
            <span>This PC</span>
          </button>
          <button type="button" id="btnExplorerBack" disabled class="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:pointer-events-none text-gray-200 text-xs font-medium flex items-center gap-1 transition shrink-0">
            <span>&uarr; Naik</span>
          </button>
          <input type="text"
            id="explorerCurrentPath"
            value="ROOT"
            placeholder="Ketik path direktori (misal: D:\ atau C:\Users) lalu Enter..."
            autocomplete="off"
            spellcheck="false"
            class="flex-1 min-w-0 bg-gray-950 border border-gray-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-200 placeholder-gray-600 outline-none transition" />
          <button type="button" id="btnExplorerRefresh" title="Muat Ulang" class="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition shrink-0">
            &#x21bb;
          </button>
        </div>

        <div id="explorerBody" class="flex-1 overflow-y-auto divide-y divide-gray-800/70 bg-gray-900 min-h-[280px]"></div>

        <div class="px-5 py-2.5 bg-gray-950 border-t border-gray-800 flex items-center justify-between text-[11px] text-gray-400">
          <span id="explorerItemCount">0 item</span>
          <span>Mode Audit: Hanya menampilkan nama & ukuran direktori/file</span>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  explorerDom = {
    modal,
    pcName: document.getElementById("explorerPcName"),
    body: document.getElementById("explorerBody"),
    path: document.getElementById("explorerCurrentPath"),
    backBtn: document.getElementById("btnExplorerBack"),
    count: document.getElementById("explorerItemCount"),
  };

  explorerDom.path.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const typedPath = explorerDom.path.value.trim() || "ROOT";
      navigateExplorer(typedPath);
    }
  });

  explorerDom.path.addEventListener("focus", () => {
    explorerDom.path.select();
  });

  // Pasang event listener sekali saja (Event Delegation)
  document.getElementById("btnCloseExplorer").onclick = closeDirectoryExplorerModal;
  document.getElementById("btnExplorerRoot").onclick = () => navigateExplorer("ROOT");
  document.getElementById("btnExplorerBack").onclick = navigateExplorerBack;
  document.getElementById("btnExplorerRefresh").onclick = refreshExplorerCurrent;

  explorerDom.body.addEventListener("click", (e) => {
    const dirBtn = e.target.closest("[data-dir-path]");
    if (dirBtn) {
      navigateExplorer(dirBtn.dataset.dirPath);
    }
  });

  return explorerDom;
}

document.addEventListener("DOMContentLoaded", ensureExplorerModal);

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function openDirectoryExplorerModal(clientId, pcName) {
  document.querySelectorAll(".dropdown-menu").forEach((el) => el.classList.add("hidden"));

  const dom = ensureExplorerModal();
  explorerState.targetId = clientId;
  explorerState.pcName = pcName || clientId;
  explorerState.currentPath = "ROOT";
  explorerState.parentPath = null;

  dom.pcName.textContent = explorerState.pcName;
  dom.modal.classList.remove("hidden");
  dom.modal.classList.add("flex");

  navigateExplorer("ROOT");
}

function closeDirectoryExplorerModal() {
  const dom = ensureExplorerModal();
  dom.modal.classList.add("hidden");
  dom.modal.classList.remove("flex");
  // Kosongkan isi DOM saat modal ditutup agar memori browser langsung bebas
  dom.body.innerHTML = "";
}

function navigateExplorerBack() {
  if (explorerState.parentPath) {
    navigateExplorer(explorerState.parentPath);
  }
}

function refreshExplorerCurrent() {
  navigateExplorer(explorerState.currentPath || "ROOT");
}

function navigateExplorer(targetPath) {
  if (!explorerState.targetId) return;

  const dom = ensureExplorerModal();
  explorerState.currentPath = targetPath;
  dom.path.value = targetPath;
  dom.backBtn.disabled = true;

  dom.body.innerHTML = `
    <div class="flex flex-col items-center justify-center py-16 text-gray-400 gap-2.5">
      <div class="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      <span class="text-xs">Memuat isi direktori dari PC siswa...</span>
    </div>
  `;

  sendDirectCommand(explorerState.targetId, "browse_directory", {
    path: targetPath,
    log_details: `Audit struktur direktori (${targetPath}) melalui File Explorer.`,
    is_warning: false,
  });
}

socket.on("directory_audit_result", (data) => {
  const dom = ensureExplorerModal();
  if (dom.modal.classList.contains("hidden")) return;
  dom.path.value = data.path || "ROOT";
  
  const matchesTarget =
    data.device_id === explorerState.targetId || data.sid === explorerState.targetId;
  if (!matchesTarget) return;

  if (!data.success) {
    const errMsg = data.message || "Gagal memuat direktori.";
    dom.body.innerHTML = `
      <div class="flex flex-col items-center justify-center py-14 px-4 text-center text-rose-400 gap-2">
        ${EXPLORER_ICONS.alert}
        <p class="text-xs font-medium">${escapeHtml(errMsg)}</p>
      </div>
    `;
    dom.count.textContent = "0 item";
    explorerState.parentPath = data.parent || (explorerState.currentPath !== "ROOT" ? "ROOT" : null);
    dom.backBtn.disabled = !explorerState.parentPath;
    return;
  }

  explorerState.currentPath = data.path;
  explorerState.parentPath = data.parent;
  dom.path.textContent = data.path === "ROOT" ? "This PC (Daftar Drive)" : data.path;
  dom.backBtn.disabled = !data.parent;

  const items = data.items || [];
  dom.count.textContent = `${items.length} item`;

  if (items.length === 0) {
    dom.body.innerHTML = `<div class="py-14 text-center text-xs text-gray-500">Folder ini kosong.</div>`;
    return;
  }

  const isDrive = data.path === "ROOT";
  const htmlParts = new Array(items.length);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const safeName = escapeHtml(item.name);

    if (item.is_dir) {
      const icon = isDrive ? EXPLORER_ICONS.drive : EXPLORER_ICONS.folder;
      const label = isDrive ? "Drive" : "Folder";
      htmlParts[i] = `
        <button type="button" data-dir-path="${escapeHtml(item.path)}"
          class="w-full px-5 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-gray-800/80 transition group">
          <div class="flex items-center gap-3 min-w-0">
            ${icon}
            <span class="text-xs font-medium text-gray-100 group-hover:text-cyan-300 truncate">${safeName}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-[11px] text-gray-400">${label}</span>
            ${EXPLORER_ICONS.chevron}
          </div>
        </button>
      `;
    } else {
      htmlParts[i] = `
        <div class="px-5 py-2.5 flex items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-3 min-w-0">
            ${EXPLORER_ICONS.file}
            <span class="text-gray-300 truncate">${safeName}</span>
          </div>
          <span class="text-[11px] font-mono text-gray-400 shrink-0">${formatFileSize(item.size)}</span>
        </div>
      `;
    }
  }

  // Satu kali penulisan DOM + pembersihan memori saat modal ditutup
  dom.body.innerHTML = htmlParts.join("");
});