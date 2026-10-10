// ─── Helpers ──────────────────────────────────────────────────────────────────

function send(msg) {
  return browser.runtime.sendMessage(msg);
}

function escapeHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function shortUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/#.*/, "");
    const short = u.hostname + (path.length > 24 ? path.slice(0, 24) + "…" : path);
    return short;
  } catch {
    return url.slice(0, 40);
  }
}

// ─── State ────────────────────────────────────────────────────────────────────

let state = { sessions: {}, activeSession: null };
let currentEntryId = null;
let currentSessionColor = "#7c6af7";
let editingSessionId = null;
let selectedSessionColor = "#7c6af7";
let selectedEntryColor = "";
let activeColorFilter = "";
let currentSort = "date-desc";

// ─── Init ─────────────────────────────────────────────────────────────────────

async function loadAll() {
  const res = await send({ type: "GET_SESSIONS" });
  state = res;
  renderSessions();
  renderColorFilter();
  renderEntries();
}

// ─── Sessions render ──────────────────────────────────────────────────────────

function renderSessions() {
  const list = document.getElementById("sessions-list");
  list.innerHTML = "";
  Object.values(state.sessions).forEach(s => {
    const chip = document.createElement("div");
    chip.className = "session-chip" + (s.id === state.activeSession ? " active" : "");
    chip.innerHTML = `
      <span class="chip-dot" style="background:${s.color || "#7c6af7"}"></span>
      <span class="chip-name">${escapeHtml(s.name)}</span>
      <button class="chip-edit" title="Редактировать">✎</button>
      <button class="chip-del" title="Удалить">×</button>
    `;
    chip.querySelector(".chip-edit").addEventListener("click", e => {
      e.stopPropagation();
      openSessionModal(s);
    });
    chip.querySelector(".chip-del").addEventListener("click", async e => {
      e.stopPropagation();
      const res = await send({ type: "DELETE_SESSION", sessionId: s.id });
      if (res.ok) {
        if (res.activeSession) state.activeSession = res.activeSession;
        activeColorFilter = "";
        await loadAll();
      }
    });
    chip.addEventListener("click", async () => {
      await send({ type: "SWITCH_SESSION", sessionId: s.id });
      state.activeSession = s.id;
      activeColorFilter = "";
      renderSessions();
      renderColorFilter();
      renderEntries();
    });
    list.appendChild(chip);
  });
}

// ─── Color filter ─────────────────────────────────────────────────────────────

const PALETTE = ["#7c6af7","#f76a6a","#6af7a0","#f7c46a","#6ac8f7","#f76ac8","#a0f76a","#f7a06a"];

function renderColorFilter() {
  const session = state.sessions[state.activeSession];
  const container = document.getElementById("color-filter");
  container.innerHTML = "";
  if (!session) return;

  // Собираем только те цвета, которые реально используются
  const usedColors = [...new Set(session.entries.map(e => e.color).filter(Boolean))];
  if (usedColors.length === 0) return;

  usedColors.forEach(color => {
    const btn = document.createElement("button");
    btn.className = "filter-dot" + (activeColorFilter === color ? " active" : "");
    btn.style.background = color;
    btn.title = color;
    btn.addEventListener("click", () => {
      activeColorFilter = activeColorFilter === color ? "" : color;
      renderColorFilter();
      renderEntries();
    });
    container.appendChild(btn);
  });
}

// ─── Entries render ───────────────────────────────────────────────────────────

function getSortedFilteredEntries(query = "") {
  const session = state.sessions[state.activeSession];
  if (!session) return [];

  let entries = [...session.entries];

  // Фильтр по тексту
  const q = query.toLowerCase().trim();
  if (q) {
    entries = entries.filter(e =>
      e.text.toLowerCase().includes(q) ||
      (e.title || "").toLowerCase().includes(q) ||
      (e.pageTitle || "").toLowerCase().includes(q) ||
      (e.comment || "").toLowerCase().includes(q)
    );
  }

  // Фильтр по цвету
  if (activeColorFilter) {
    entries = entries.filter(e => e.color === activeColorFilter);
  }

  // Сортировка
  switch (currentSort) {
    case "date-asc":
      entries.sort((a, b) => a.savedAt - b.savedAt);
      break;
    case "date-desc":
      entries.sort((a, b) => b.savedAt - a.savedAt);
      break;
    case "source":
      entries.sort((a, b) => (a.pageTitle || a.url || "").localeCompare(b.pageTitle || b.url || ""));
      break;
    case "color":
      entries.sort((a, b) => (a.color || "").localeCompare(b.color || ""));
      break;
  }

  return entries;
}

function renderEntries(query = "") {
  const session = state.sessions[state.activeSession];
  const nameEl = document.getElementById("session-name");
  nameEl.textContent = session ? session.name : "—";
  currentSessionColor = session ? (session.color || "#7c6af7") : "#7c6af7";

  const list = document.getElementById("entries-list");
  const entries = getSortedFilteredEntries(query);

  if (!entries.length) {
    list.innerHTML = `<p class="empty-state">Нет цитат.<br>Выделите текст и нажмите ПКМ → «Сохранить цитату».</p>`;
    return;
  }

  list.innerHTML = "";
  entries.forEach(entry => {
    const accentColor = entry.color || currentSessionColor;
    const card = document.createElement("div");
    card.className = "entry-card";
    const sourceLabel = entry.pageTitle || shortUrl(entry.url) || "";
    card.innerHTML = `
      <div class="entry-accent-bar" style="background:${accentColor}"></div>
      <button class="entry-delete-btn" title="Удалить">×</button>
      ${entry.title ? `<div class="entry-title">${escapeHtml(entry.title)}</div>` : ""}
      <div class="entry-text">${escapeHtml(entry.text)}</div>
      <div class="entry-meta">
        ${entry.favicon ? `<img class="entry-favicon" src="${escapeHtml(entry.favicon)}" />` : ""}
        <span class="entry-source">${escapeHtml(sourceLabel)}</span>
        ${entry.comment ? `<span class="entry-comment-badge">заметка</span>` : ""}
      </div>
    `;
    const favicon = card.querySelector(".entry-favicon");
    if (favicon) favicon.addEventListener("error", () => { favicon.style.display = "none"; });
    card.querySelector(".entry-delete-btn").addEventListener("click", async e => {
      e.stopPropagation();
      await send({ type: "DELETE_ENTRY", entryId: entry.id });
      await loadAll();
    });
    card.addEventListener("click", () => openEntryModal(entry));
    list.appendChild(card);
  });
}

// ─── Entry modal ──────────────────────────────────────────────────────────────

function openEntryModal(entry) {
  currentEntryId = entry.id;
  selectedEntryColor = entry.color || "";

  document.getElementById("modal-title").value = entry.title || "";
  document.getElementById("modal-text").value = entry.text;
  const urlEl = document.getElementById("modal-url");
  urlEl.textContent = entry.url || "";
  urlEl.href = entry.url || "#";
  document.getElementById("modal-comment").value = entry.comment || "";
  document.getElementById("modal-date").textContent =
    entry.savedAt ? new Date(entry.savedAt).toLocaleString("ru") : "";

  updateEntrySwatches();
  document.getElementById("modal-entry").classList.remove("hidden");
}

function updateEntrySwatches() {
  document.querySelectorAll("#entry-color-picker .color-swatch").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.color === selectedEntryColor);
  });
}

document.querySelectorAll("#entry-color-picker .color-swatch").forEach(btn => {
  btn.addEventListener("click", () => {
    selectedEntryColor = btn.dataset.color;
    updateEntrySwatches();
  });
});

document.getElementById("modal-close").addEventListener("click", () => {
  document.getElementById("modal-entry").classList.add("hidden");
});

document.getElementById("modal-save").addEventListener("click", async () => {
  await send({
    type: "UPDATE_ENTRY",
    entryId: currentEntryId,
    fields: {
      title:   document.getElementById("modal-title").value.trim(),
      text:    document.getElementById("modal-text").value.trim(),
      comment: document.getElementById("modal-comment").value.trim(),
      color:   selectedEntryColor
    }
  });
  document.getElementById("modal-entry").classList.add("hidden");
  await loadAll();
});

document.getElementById("modal-delete").addEventListener("click", async () => {
  await send({ type: "DELETE_ENTRY", entryId: currentEntryId });
  document.getElementById("modal-entry").classList.add("hidden");
  await loadAll();
});

// ─── Move modal ───────────────────────────────────────────────────────────────

document.getElementById("btn-move").addEventListener("click", () => {
  const moveList = document.getElementById("move-sessions-list");
  moveList.innerHTML = "";

  Object.values(state.sessions)
    .filter(s => s.id !== state.activeSession)
    .forEach(s => {
      const btn = document.createElement("button");
      btn.className = "move-session-btn";
      btn.innerHTML = `<span class="chip-dot" style="background:${s.color || "#7c6af7"}"></span>${escapeHtml(s.name)}`;
      btn.addEventListener("click", async () => {
        await send({ type: "MOVE_ENTRY", entryId: currentEntryId, targetSessionId: s.id });
        document.getElementById("modal-move").classList.add("hidden");
        document.getElementById("modal-entry").classList.add("hidden");
        await loadAll();
      });
      moveList.appendChild(btn);
    });

  if (moveList.children.length === 0) {
    moveList.innerHTML = `<p class="empty-state" style="padding:12px 0">Нет других работ</p>`;
  }

  document.getElementById("modal-move").classList.remove("hidden");
});

document.getElementById("modal-move-close").addEventListener("click", () => {
  document.getElementById("modal-move").classList.add("hidden");
});

// ─── Session modal ────────────────────────────────────────────────────────────

function openSessionModal(session = null) {
  editingSessionId = session ? session.id : null;
  selectedSessionColor = session ? (session.color || "#7c6af7") : "#7c6af7";
  document.getElementById("modal-session-title").textContent = session ? "Редактировать работу" : "Новая работа";
  document.getElementById("modal-session-name").value = session ? session.name : "";
  updateSessionSwatches();
  document.getElementById("modal-session").classList.remove("hidden");
}

function updateSessionSwatches() {
  document.querySelectorAll("#modal-session .color-swatch").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.color === selectedSessionColor);
  });
}

document.querySelectorAll("#modal-session .color-swatch").forEach(btn => {
  btn.addEventListener("click", () => {
    selectedSessionColor = btn.dataset.color;
    updateSessionSwatches();
  });
});

document.getElementById("modal-session-close").addEventListener("click", () => {
  document.getElementById("modal-session").classList.add("hidden");
});
document.getElementById("modal-session-cancel").addEventListener("click", () => {
  document.getElementById("modal-session").classList.add("hidden");
});

document.getElementById("modal-session-save").addEventListener("click", async () => {
  const name = document.getElementById("modal-session-name").value.trim();
  if (!name) return;
  if (editingSessionId) {
    await send({ type: "RENAME_SESSION", sessionId: editingSessionId, name, color: selectedSessionColor });
  } else {
    await send({ type: "CREATE_SESSION", name, color: selectedSessionColor });
  }
  document.getElementById("modal-session").classList.add("hidden");
  await loadAll();
});

document.getElementById("btn-new-session").addEventListener("click", () => openSessionModal());

// ─── Search + sort ────────────────────────────────────────────────────────────

let searchQuery = "";

document.getElementById("search").addEventListener("input", e => {
  searchQuery = e.target.value;
  renderEntries(searchQuery);
});

document.getElementById("sort-select").addEventListener("change", e => {
  currentSort = e.target.value;
  renderEntries(searchQuery);
});

// ─── Export ───────────────────────────────────────────────────────────────────

document.getElementById("btn-export-json").addEventListener("click", () => send({ type: "EXPORT_JSON" }));
document.getElementById("btn-export-txt").addEventListener("click", () => send({ type: "EXPORT_TXT" }));
document.getElementById("btn-export-md").addEventListener("click", () => send({ type: "EXPORT_MD" }));

// ─── Live update from background ─────────────────────────────────────────────

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  // Не обновляем пока открыта модалка цитаты — иначе сбросятся несохранённые изменения
  const modalOpen = !document.getElementById("modal-entry").classList.contains("hidden");
  if (!modalOpen) loadAll();
});

// ─── Start ────────────────────────────────────────────────────────────────────

loadAll();
