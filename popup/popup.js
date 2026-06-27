// popup.js

async function send(type, payload = {}) {
  return browser.runtime.sendMessage({ type, ...payload });
}

async function render() {
  const data = await send("GET_DATA");
  const session = data.sessions[data.activeSession];

  document.getElementById("session-name").textContent = session.name;
  document.getElementById("count").textContent = session.entries.length;
}

// ── Сохранить цитату с текущей страницы ──────────────────────────────────────
document.getElementById("btn-save").addEventListener("click", async () => {
  const text = document.getElementById("quick-text").value.trim();
  if (!text) return;

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const entry = {
    id: "entry_" + Date.now(),
    text,
    url: tab.url,
    pageTitle: tab.title,
    savedAt: new Date().toISOString(),
    note: ""
  };

  await send("SAVE_ENTRY", { entry });
  document.getElementById("quick-text").value = "";
  await render();
});

// ── Новая сессия ──────────────────────────────────────────────────────────────
document.getElementById("btn-new-session").addEventListener("click", async () => {
  const name = prompt("Название новой работы:");
  if (!name || !name.trim()) return;
  await send("CREATE_SESSION", { name: name.trim() });
  await render();
});

// ── Переключить сессию ────────────────────────────────────────────────────────
document.getElementById("btn-switch").addEventListener("click", async () => {
  const data = await send("GET_DATA");
  const sessions = Object.values(data.sessions);
  const names = sessions.map((s, i) =>
    `${i + 1}. ${s.name} (${s.entries.length} цит.)`
  ).join("\n");

  const choice = prompt(`Выберите работу (введите номер):\n${names}`);
  const idx = parseInt(choice, 10) - 1;
  if (isNaN(idx) || !sessions[idx]) return;
  await send("SWITCH_SESSION", { sessionId: sessions[idx].id });
  await render();
});

// ── Экспорт ───────────────────────────────────────────────────────────────────
document.getElementById("btn-export-json").addEventListener("click", () =>
  send("EXPORT_JSON")
);
document.getElementById("btn-export-txt").addEventListener("click", () =>
  send("EXPORT_CITATIONS")
);

// ── Открыть боковую панель ────────────────────────────────────────────────────
document.getElementById("btn-sidebar").addEventListener("click", () => {
  browser.sidebarAction.toggle();
});

// ── Старт ─────────────────────────────────────────────────────────────────────
render();
