const CHAT_ICONS = {
  chat: `<svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  close: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
  send: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  search: `<svg class="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  back: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>`,
  checkDoubleRead: `<svg class="w-3.5 h-3.5 text-sky-300 inline-block ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>`,
  checkDoubleSent: `<svg class="w-3.5 h-3.5 text-cyan-100/70 inline-block ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>`
};

let waChatState = {
  isOpen: false,
  activeClientId: "",
  searchKeyword: "",
  isLoadingOverview: false,
  overviewLoaded: false,
  contacts: [], // [{ id, name, lastMessage, lastSenderName, lastTime, unreadCount, lastActivityTs }]
};

let waChatDom = null;

function formatUnreadBadgeText(count) {
  const num = Number(count || 0);
  if (num <= 0) return "";
  return num >= 10 ? "9+" : String(num);
}

function initWhatsAppChatWidget() {
  if (waChatDom) return waChatDom;

  const initialClients = typeof clients !== "undefined" && Array.isArray(clients) ? clients : [];
  waChatState.contacts = initialClients.map((c, idx) => ({
    id: String(c.id),
    name: c.name || `PC-${c.id}`,
    lastMessage: "Memuat percakapan...",
    lastSenderName: "",
    lastTime: "",
    unreadCount: 0,
    lastActivityTs: initialClients.length - idx,
  }));

  const fab = document.createElement("button");
  fab.id = "floating-wa-chat-btn";
  fab.type = "button";
  fab.title = "Buka Chat Siswa";
  fab.className = "fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-2xl shadow-emerald-950/70 flex items-center justify-center transition-all cursor-pointer border border-emerald-400/30";
  fab.innerHTML = `
    ${CHAT_ICONS.chat}
    <span id="floating-chat-total-badge" class="hidden absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-rose-500 border-2 border-gray-950 text-[11px] font-bold text-white flex items-center justify-center">0</span>
  `;
  fab.onclick = toggleFloatingChatDrawer;
  document.body.appendChild(fab);

  const panel = document.createElement("div");
  panel.id = "floating-wa-chat-panel";
  panel.className = "hidden fixed bottom-24 right-5 z-50 w-[370px] max-w-[calc(100vw-2.5rem)] h-[540px] max-h-[calc(100vh-7.5rem)] bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex-col";

  panel.innerHTML = `
    <!-- VIEW 1: DAFTAR KONTAK CLIENT (WHATSAPP LIST) -->
    <div id="wa-contact-list-view" class="flex flex-col h-full">
      <div class="px-4 py-3.5 bg-gray-950 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            Pesan & Laporan Siswa
          </h3>
          <p class="text-[11px] text-gray-400">Pilih PC siswa untuk membaca atau membalas</p>
        </div>
        <button type="button" id="btn-close-wa-panel" class="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition">
          ${CHAT_ICONS.close}
        </button>
      </div>

      <!-- Search Bar Hostname -->
      <div class="p-2.5 bg-gray-950/60 border-b border-gray-800">
        <div class="flex items-center gap-2 bg-gray-900 border border-gray-800 focus-within:border-emerald-500 rounded-xl px-3 py-2 transition">
          ${CHAT_ICONS.search}
          <input type="text" id="wa-search-client-input" placeholder="Cari hostname atau nama siswa..." autocomplete="off"
            class="w-full bg-transparent text-xs text-gray-100 placeholder-gray-500 focus:outline-none" />
        </div>
      </div>

      <!-- List Kontak -->
      <div id="wa-contacts-container" class="flex-1 overflow-y-auto divide-y divide-gray-800/60 bg-gray-900"></div>
    </div>

    <!-- VIEW 2: RUANG OBROLAN (ROOM CHAT) -->
    <div id="wa-chat-room-view" class="hidden flex-col h-full">
      <div class="px-3.5 py-3 bg-gray-950 border-b border-gray-800 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2.5 min-w-0">
          <button type="button" id="btn-back-wa-contacts" class="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition shrink-0" title="Kembali ke Daftar PC">
            ${CHAT_ICONS.back}
          </button>
          <div id="wa-room-avatar" class="w-8 h-8 rounded-full bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center font-bold text-xs uppercase shrink-0">
            PC
          </div>
          <div class="min-w-0">
            <h4 id="wa-room-student-name" class="text-xs font-bold text-white truncate">Nama Siswa</h4>
            <p id="wa-room-hostname-sub" class="text-[10px] text-gray-400 font-mono truncate">HOSTNAME</p>
          </div>
        </div>
        <button type="button" id="btn-close-wa-room" class="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition shrink-0">
          ${CHAT_ICONS.close}
        </button>
      </div>

      <div id="wa-messages-container" class="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-gray-900"></div>

      <form id="wa-send-form" class="p-3 bg-gray-950 border-t border-gray-800 flex items-center gap-2">
        <input type="text" id="wa-message-input" placeholder="Ketik pesan balasan..." autocomplete="off"
          class="flex-1 min-w-0 bg-gray-900 border border-gray-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-gray-100 placeholder-gray-500 outline-none transition" />
        <button type="submit" id="wa-send-submit-btn"
          class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer">
          ${CHAT_ICONS.send}
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(panel);

  waChatDom = {
    fab,
    totalBadge: document.getElementById("floating-chat-total-badge"),
    panel,
    listView: document.getElementById("wa-contact-list-view"),
    roomView: document.getElementById("wa-chat-room-view"),
    searchInput: document.getElementById("wa-search-client-input"),
    contactsContainer: document.getElementById("wa-contacts-container"),
    roomAvatar: document.getElementById("wa-room-avatar"),
    roomStudentName: document.getElementById("wa-room-student-name"),
    roomHostnameSub: document.getElementById("wa-room-hostname-sub"),
    messagesContainer: document.getElementById("wa-messages-container"),
    sendForm: document.getElementById("wa-send-form"),
    messageInput: document.getElementById("wa-message-input"),
    sendBtn: document.getElementById("wa-send-submit-btn"),
  };

  document.getElementById("btn-close-wa-panel").onclick = closeFloatingChatDrawer;
  document.getElementById("btn-close-wa-room").onclick = closeFloatingChatDrawer;
  document.getElementById("btn-back-wa-contacts").onclick = showContactListView;

  waChatDom.searchInput.oninput = (e) => {
    waChatState.searchKeyword = e.target.value.toLowerCase().trim();
    renderContactList();
  };

  waChatDom.contactsContainer.onclick = (e) => {
    const itemBtn = e.target.closest("[data-wa-client-id]");
    if (itemBtn) {
      openChatRoom(itemBtn.dataset.waClientId);
    }
  };

  waChatDom.sendForm.onsubmit = (e) => {
    e.preventDefault();
    sendWaAdminReply();
  };

  return waChatDom;
}

document.addEventListener("DOMContentLoaded", () => {
  initWhatsAppChatWidget();
  if (typeof socket !== "undefined" && socket.connected) {
    fetchChatOverviewFromServer(false);
  }
});

function escapeWaHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatWaTime(ts) {
  if (!ts) return "";
  return ts.length >= 16 ? ts.slice(11, 16) : ts;
}

function getOrCreateContact(clientId, fallbackName = "") {
  const idStr = String(clientId);
  let contact = waChatState.contacts.find((c) => c.id === idStr);
  if (!contact) {
    contact = {
      id: idStr,
      name: fallbackName || `PC-${idStr}`,
      lastMessage: "Belum ada riwayat pesan",
      lastSenderName: "",
      lastTime: "",
      unreadCount: 0,
      lastActivityTs: Date.now(),
    };
    waChatState.contacts.unshift(contact);
  } else if (fallbackName && !contact.lastSenderName) {
    contact.lastSenderName = fallbackName;
  }
  return contact;
}

function updateGlobalUnreadBadge() {
  const dom = initWhatsAppChatWidget();
  const totalUnread = waChatState.contacts.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  if (totalUnread > 0) {
    dom.totalBadge.textContent = formatUnreadBadgeText(totalUnread);
    dom.totalBadge.classList.remove("hidden");
  } else {
    dom.totalBadge.classList.add("hidden");
  }
}

// Ambil 10 pesan terakhir per client & hitung is_read kosong/false dari server
function fetchChatOverviewFromServer(showLoadingSpinner = true) {
  const dom = initWhatsAppChatWidget();
  if (waChatState.isLoadingOverview) return;

  waChatState.isLoadingOverview = true;
  if (showLoadingSpinner && waChatState.isOpen && !waChatState.activeClientId) {
    dom.contactsContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full py-16 text-gray-400 gap-2.5">
        <div class="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-xs">Sinkronisasi pesan dari server...</span>
      </div>
    `;
  }

  socket.emit("get_chat_overview", {}, (resp) => {
    waChatState.isLoadingOverview = false;
    waChatState.overviewLoaded = true;

    const overviewMap = new Map();
    if (resp && resp.ok && Array.isArray(resp.items)) {
      resp.items.forEach((row, index) => {
        overviewMap.set(String(row.client_id), { row, index });
      });
    }

    const baseTs = Date.now();
    waChatState.contacts.forEach((contact, defaultIdx) => {
      const entry = overviewMap.get(contact.id);
      if (entry) {
        const { row, index } = entry;
        if (row.sender_role === "student" && row.sender_name) {
          contact.lastSenderName = row.sender_name;
        }
        contact.lastMessage =
          row.sender_role === "admin" ? `Anda: ${row.message}` : row.message;
        contact.lastTime = formatWaTime(row.created_at);
        // Hitungan is_read kosong/false dari 10 pesan terakhir (maks 10 -> badge "9+")
        contact.unreadCount = Number(row.unread_in_last_10 || 0);
        contact.lastActivityTs = baseTs - index * 1000;
        overviewMap.delete(contact.id);
      } else if (!contact.lastTime) {
        contact.lastMessage = "Belum ada riwayat pesan";
        contact.unreadCount = 0;
        contact.lastActivityTs = waChatState.contacts.length - defaultIdx;
      }
    });

    // Jika ada client_id baru dari server yang belum ada di list lokal
    overviewMap.forEach(({ row, index }, cid) => {
      const contact = getOrCreateContact(cid, row.sender_role === "student" ? row.sender_name : "");
      contact.lastMessage =
        row.sender_role === "admin" ? `Anda: ${row.message}` : row.message;
      contact.lastTime = formatWaTime(row.created_at);
      contact.unreadCount = Number(row.unread_in_last_10 || 0);
      contact.lastActivityTs = baseTs - index * 1000;
    });

    updateGlobalUnreadBadge();
    if (waChatState.isOpen && !waChatState.activeClientId) {
      renderContactList();
    }
  });
}

function renderContactList() {
  const dom = initWhatsAppChatWidget();
  const kw = waChatState.searchKeyword;

  const sorted = [...waChatState.contacts].sort((a, b) => b.lastActivityTs - a.lastActivityTs);
  const filtered = kw
    ? sorted.filter(
        (c) =>
          c.name.toLowerCase().includes(kw) ||
          (c.lastSenderName && c.lastSenderName.toLowerCase().includes(kw))
      )
    : sorted;

  if (filtered.length === 0) {
    dom.contactsContainer.innerHTML = `
      <div class="py-12 text-center text-xs text-gray-500">
        Tidak ada perangkat yang cocok dengan pencarian.
      </div>
    `;
    return;
  }

  dom.contactsContainer.innerHTML = filtered
    .map((c) => {
      const isOnline = typeof connectedPcs !== "undefined" && connectedPcs.has(c.id);
      const displayName =
        c.lastSenderName && c.lastSenderName !== c.name
          ? `${c.lastSenderName} (${c.name})`
          : c.name;
      const initial = escapeWaHtml((c.lastSenderName || c.name).slice(0, 2));
      const badgeLabel = formatUnreadBadgeText(c.unreadCount);
      const unreadHtml = badgeLabel
        ? `<span class="px-1.5 py-0.5 min-w-[22px] text-center rounded-full bg-emerald-500 text-gray-950 font-bold text-[10px] shrink-0">${badgeLabel}</span>`
        : "";

      return `
        <button type="button" data-wa-client-id="${escapeWaHtml(c.id)}"
          class="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-800/70 transition cursor-pointer">
          <div class="relative shrink-0">
            <div class="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 text-indigo-300 flex items-center justify-center font-bold text-xs uppercase">
              ${initial}
            </div>
            <span class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${isOnline ? "bg-emerald-400" : "bg-rose-500"}"></span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-bold text-gray-100 truncate">${escapeWaHtml(displayName)}</span>
              <span class="text-[10px] ${c.unreadCount > 0 ? "text-emerald-400 font-semibold" : "text-gray-500"} shrink-0">${escapeWaHtml(c.lastTime)}</span>
            </div>
            <div class="flex items-center justify-between gap-2 mt-0.5">
              <p class="text-[11px] ${c.unreadCount > 0 ? "text-gray-200 font-medium" : "text-gray-400"} truncate">${escapeWaHtml(c.lastMessage)}</p>
              ${unreadHtml}
            </div>
          </div>
        </button>
      `;
    })
    .join("");
}

function toggleFloatingChatDrawer() {
  const dom = initWhatsAppChatWidget();
  waChatState.isOpen = !waChatState.isOpen;
  if (waChatState.isOpen) {
    dom.panel.classList.remove("hidden");
    dom.panel.classList.add("flex");
    if (!waChatState.activeClientId) {
      // Tampilkan loading & ambil data awal dari server setiap kali laci chat dibuka
      fetchChatOverviewFromServer(true);
      dom.searchInput.focus();
    }
  } else {
    closeFloatingChatDrawer();
  }
}

function closeFloatingChatDrawer() {
  const dom = initWhatsAppChatWidget();
  waChatState.isOpen = false;
  dom.panel.classList.add("hidden");
  dom.panel.classList.remove("flex");
}

function showContactListView() {
  const dom = initWhatsAppChatWidget();
  waChatState.activeClientId = "";
  dom.roomView.classList.add("hidden");
  dom.roomView.classList.remove("flex");
  dom.listView.classList.remove("hidden");
  dom.listView.classList.add("flex");
  fetchChatOverviewFromServer(true);
}

function buildWaBubbleHtml(msg) {
  const isAdmin = msg.sender_role === "admin";
  const safeText = escapeWaHtml(msg.message);
  const timeStr = formatWaTime(msg.created_at) || new Date().toTimeString().slice(0, 5);

  if (isAdmin) {
    const readTick = Number(msg.is_read) === 1 ? CHAT_ICONS.checkDoubleRead : CHAT_ICONS.checkDoubleSent;
    return `
      <div class="flex justify-end">
        <div class="max-w-[82%] bg-emerald-700 text-white rounded-2xl rounded-br-sm px-3.5 py-2 shadow">
          <p class="text-xs leading-relaxed break-words">${safeText}</p>
          <div class="text-[10px] text-emerald-100/80 text-right mt-1 flex items-center justify-end">
            <span>${timeStr}</span>
            ${readTick}
          </div>
        </div>
      </div>
    `;
  }

  const safeSender = escapeWaHtml(msg.sender_name || "Siswa");
  return `
    <div class="flex justify-start">
      <div class="max-w-[82%] bg-gray-800 border border-gray-700 text-gray-100 rounded-2xl rounded-bl-sm px-3.5 py-2 shadow">
        <div class="text-[10px] font-semibold text-emerald-400 mb-0.5">${safeSender}</div>
        <p class="text-xs leading-relaxed break-words">${safeText}</p>
        <div class="text-[10px] text-gray-400 text-right mt-1">${timeStr}</div>
      </div>
    </div>
  `;
}

function openChatRoom(clientId) {
  const dom = initWhatsAppChatWidget();
  const contact = getOrCreateContact(clientId);

  waChatState.isOpen = true;
  waChatState.activeClientId = String(clientId);
  contact.unreadCount = 0;
  updateGlobalUnreadBadge();

  const headerName = contact.lastSenderName || contact.name;
  dom.roomStudentName.textContent = headerName;
  dom.roomHostnameSub.textContent = contact.name;
  dom.roomAvatar.textContent = headerName.slice(0, 2).toUpperCase();

  dom.panel.classList.remove("hidden");
  dom.panel.classList.add("flex");
  dom.listView.classList.add("hidden");
  dom.listView.classList.remove("flex");
  dom.roomView.classList.remove("hidden");
  dom.roomView.classList.add("flex");

  dom.messagesContainer.innerHTML = `
    <div class="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
      <div class="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
      <span class="text-xs">Memuat percakapan...</span>
    </div>
  `;

  socket.emit("request_chat_history", { client_id: clientId, role: "admin" }, (resp) => {
    if (waChatState.activeClientId !== String(clientId)) return;
    if (!resp || !resp.ok) {
      dom.messagesContainer.innerHTML = `<div class="text-center text-xs text-rose-400 py-10">Gagal memuat riwayat pesan.</div>`;
      return;
    }

    const messages = resp.messages || [];
    const lastStudentMsg = [...messages].reverse().find((m) => m.sender_role === "student" && m.sender_name);
    if (lastStudentMsg) {
      contact.lastSenderName = lastStudentMsg.sender_name;
      dom.roomStudentName.textContent = lastStudentMsg.sender_name;
      dom.roomAvatar.textContent = lastStudentMsg.sender_name.slice(0, 2).toUpperCase();
    }

    if (messages.length === 0) {
      dom.messagesContainer.innerHTML = `
        <div class="text-center text-xs text-gray-500 py-12">
          Belum ada pesan dengan ${escapeWaHtml(headerName)}.
        </div>
      `;
    } else {
      dom.messagesContainer.innerHTML = messages.map(buildWaBubbleHtml).join("");
      dom.messagesContainer.scrollTop = dom.messagesContainer.scrollHeight;
    }
    dom.messageInput.focus();
  });
}

function sendWaAdminReply() {
  const dom = initWhatsAppChatWidget();
  const text = dom.messageInput.value.trim();
  const targetClientId = waChatState.activeClientId;
  if (!text || !targetClientId) return;

  dom.messageInput.value = "";
  dom.messageInput.disabled = true;
  dom.sendBtn.disabled = true;

  socket.emit(
    "admin_chat_reply",
    {
      client_id: targetClientId,
      admin_name: typeof user !== "undefined" && user?.username ? user.username : "Guru / Admin",
      message: text,
    },
    (resp) => {
      dom.messageInput.disabled = false;
      dom.sendBtn.disabled = false;
      dom.messageInput.focus();

      if (resp && resp.ok && resp.message_data) {
        const msg = resp.message_data;
        const contact = getOrCreateContact(targetClientId);
        contact.lastMessage = `Anda: ${msg.message}`;
        contact.lastTime = formatWaTime(msg.created_at) || new Date().toTimeString().slice(0, 5);
        contact.lastActivityTs = Date.now();

        if (waChatState.activeClientId === targetClientId) {
          if (dom.messagesContainer.querySelector(".text-gray-500")) {
            dom.messagesContainer.innerHTML = "";
          }
          dom.messagesContainer.insertAdjacentHTML("beforeend", buildWaBubbleHtml(msg));
          dom.messagesContainer.scrollTop = dom.messagesContainer.scrollHeight;
        }
      }
    }
  );
}

socket.on("connect", () => {
  fetchChatOverviewFromServer(false);
});

socket.on("new_student_chat", (msg) => {
  if (!msg || !msg.client_id) return;

  const dom = initWhatsAppChatWidget();
  const cid = String(msg.client_id);
  const contact = getOrCreateContact(cid, msg.sender_name || "");

  if (msg.sender_role === "student" && msg.sender_name) {
    contact.lastSenderName = msg.sender_name;
  }
  contact.lastMessage = msg.sender_role === "admin" ? `Anda: ${msg.message}` : msg.message;
  contact.lastTime = formatWaTime(msg.created_at) || new Date().toTimeString().slice(0, 5);
  contact.lastActivityTs = Date.now();

  const isViewingThisRoom = waChatState.isOpen && waChatState.activeClientId === cid;

  if (isViewingThisRoom) {
    if (msg.sender_role === "student" && msg.sender_name) {
      dom.roomStudentName.textContent = msg.sender_name;
      dom.roomAvatar.textContent = msg.sender_name.slice(0, 2).toUpperCase();
      socket.emit("request_chat_history", { client_id: cid, role: "admin" });
    }

    if (msg.sender_role === "student") {
      if (dom.messagesContainer.querySelector(".text-gray-500")) {
        dom.messagesContainer.innerHTML = "";
      }
      dom.messagesContainer.insertAdjacentHTML("beforeend", buildWaBubbleHtml(msg));
      dom.messagesContainer.scrollTop = dom.messagesContainer.scrollHeight;
    }
  } else if (msg.sender_role === "student") {
    // Maksimal penghitungan dari 10 pesan terakhir (jika 10 semua belum terbaca -> 9+)
    contact.unreadCount = Math.min(10, (contact.unreadCount || 0) + 1);
    updateGlobalUnreadBadge();
    if (waChatState.isOpen && !waChatState.activeClientId) {
      renderContactList();
    }

    if (typeof Toastify !== "undefined") {
      Toastify({
        text: `💬 ${msg.sender_name || contact.name}: ${msg.message}`,
        duration: 5000,
        gravity: "top",
        position: "right",
        stopOnFocus: true,
        onClick: () => openChatRoom(cid),
        style: {
          background: "#064e3b",
          color: "#ecfdf5",
          border: "1px solid #10b981",
          borderRadius: "0.75rem",
          fontSize: "0.8125rem",
          cursor: "pointer"
        }
      }).showToast();
    }
  }
});

socket.on("chat_messages_read", (data) => {
  const cid = String(data?.client_id || "");
  if (!cid || waChatState.activeClientId !== cid) return;

  const dom = initWhatsAppChatWidget();
  dom.messagesContainer.querySelectorAll("svg.text-cyan-100\\/70").forEach((svgEl) => {
    svgEl.classList.remove("text-cyan-100/70");
    svgEl.classList.add("text-sky-300");
  });
});