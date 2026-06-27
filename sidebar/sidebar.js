// sidebar.js

let allEntries = [];

async function send(type, payload = {}) {
  return browser.runtime.sendMessage({ type, ...payload });
}

// ─── Отрисовать список сессий ──────────────────────────────────────────────────
function renderSessions(data) {
  const container = document.getElementById("sessions-list");
  container.innerHTML = "";

  Object.values(data.sessions).forEach(session => {
    const isActive = session.id === data.activeSession;

    const chip = document.createElement("div");
    chip.className = "session-chip" + (isActive ? " active" : "");

    const name = document.createElement("span");
    name.className = "chip-name";
    name.textContent = session.name;

    const count = document.createElement("span");
    count.className = "chip-count";
    count.textContent = session.entries.length;

    const delBtn = document.createElement("button");
    delBtn.className = "chip-del";
    delBtn.textContent = "×";
    delBtn.title = "Удалить работу";
    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`Удалить «${session.name}» и все её цитаты?`)) return;
      await send("DELETE_SESSION", { sessionId: session.id });
      await renderAll();
    });

    chip.appendChild(name);
    chip.appendChild(count);
    chip.appendChild(delBtn); // кнопка удаления есть у всех сессий

    chip.addEventListener("click", async (e) => {
      if (e.target === delBtn) return;
      if (isActive) return;
      await send("SWITCH_SESSION", { sessionId: session.id });
      await renderAll();
    });

    container.appendChild(chip);
  });
}

// ─── Отрисовать список цитат ──────────────────────────────────────────────────
function renderEntries(entries) {
  const container = document.getElementById("entries-list");
  container.innerHTML = "";

  if (!entries.length) {
    container.innerHTML = `<p class="empty-state">Нет сохранённых цитат.<br>Выделите текст на странице и выберите «Сохранить цитату».</p>`;
    return;
  }

  entries.forEach(entry => {
    const card = document.createElement("div");
    card.className = "entry-card";
    card.dataset.id = entry.id;

    const date = new Date(entry.savedAt).toLocaleString("ru", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });

    card.innerHTML = `
      <div class="entry-text">${escapeHtml(entry.text)}</div>
      <div class="entry-meta">
        <a class="entry-source" href="${entry.url}" target="_blank" title="${entry.pageTitle}">${entry.pageTitle || entry.url}</a>
        <span class="entry-date">${date}</span>
      </div>
      <div class="entry-actions">
        <button class="btn-delete" data-id="${entry.id}">Удалить</button>
      </div>
    `;

    card.querySelector(".btn-delete").addEventListener("click", async () => {
      await send("DELETE_ENTRY", { entryId: entry.id });
      await renderAll();
    });

    container.appendChild(card);
  });
}

// ─── Главная перерисовка ──────────────────────────────────────────────────────
async function renderAll() {
  const data = await send("GET_DATA");
  const session = data.sessions[data.activeSession];
  allEntries = session.entries;

  document.getElementById("session-name").textContent = session.name;

  renderSessions(data);

  const query = document.getElementById("search").value.toLowerCase();
  const filtered = query
    ? allEntries.filter(e =>
        e.text.toLowerCase().includes(query) ||
        (e.pageTitle || "").toLowerCase().includes(query)
      )
    : allEntries;

  renderEntries(filtered);
}

// ─── Поиск ────────────────────────────────────────────────────────────────────
document.getElementById("search").addEventListener("input", async (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = query
    ? allEntries.filter(e =>
        e.text.toLowerCase().includes(query) ||
        (e.pageTitle || "").toLowerCase().includes(query)
      )
    : allEntries;
  renderEntries(filtered);
});

// ─── Новая сессия ─────────────────────────────────────────────────────────────
document.getElementById("btn-new-session").addEventListener("click", async () => {
  const name = prompt("Название новой работы:");
  if (!name || !name.trim()) return;
  await send("CREATE_SESSION", { name: name.trim() });
  await renderAll();
});

// ─── Экспорт ──────────────────────────────────────────────────────────────────
document.getElementById("btn-export-json").addEventListener("click", () =>
  send("EXPORT_JSON")
);
document.getElementById("btn-export-txt").addEventListener("click", () =>
  send("EXPORT_CITATIONS")
);

// ─── Реакция на изменения хранилища (если popup что-то сохранил) ──────────────
browser.storage.onChanged.addListener(() => renderAll());

// ─── Утилиты ──────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Старт ────────────────────────────────────────────────────────────────────
renderAll();
