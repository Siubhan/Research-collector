// ─── Дефолтная структура данных ───────────────────────────────────────────────
const DEFAULT_DATA = {
  sessions: {
    "session_default": {
      id: "session_default",
      name: "Моя первая работа",
      createdAt: new Date().toISOString(),
      entries: []
    }
  },
  activeSession: "session_default"
};

// ─── Инициализация хранилища ───────────────────────────────────────────────────
async function initStorage() {
  const data = await browser.storage.local.get("researchData");
  if (!data.researchData) {
    await browser.storage.local.set({ researchData: DEFAULT_DATA });
  }
}

// ─── Получить все данные ───────────────────────────────────────────────────────
async function getData() {
  const data = await browser.storage.local.get("researchData");
  return data.researchData || DEFAULT_DATA;
}

// ─── Сохранить цитату ─────────────────────────────────────────────────────────
async function saveEntry(entry) {
  const data = await getData();
  const sessionId = data.activeSession;
  data.sessions[sessionId].entries.unshift(entry);
  await browser.storage.local.set({ researchData: data });
  return { ok: true, sessionName: data.sessions[sessionId].name };
}

// ─── Удалить цитату ────────────────────────────────────────────────────────────
async function deleteEntry(entryId) {
  const data = await getData();
  const sessionId = data.activeSession;
  data.sessions[sessionId].entries = data.sessions[sessionId].entries
    .filter(e => e.id !== entryId);
  await browser.storage.local.set({ researchData: data });
  return { ok: true };
}

// ─── Создать новую сессию ──────────────────────────────────────────────────────
async function createSession(name) {
  const data = await getData();
  const id = "session_" + Date.now();
  data.sessions[id] = {
    id,
    name,
    createdAt: new Date().toISOString(),
    entries: []
  };
  data.activeSession = id;
  await browser.storage.local.set({ researchData: data });
  return { ok: true, id };
}

// ─── Переключить сессию ────────────────────────────────────────────────────────
async function switchSession(sessionId) {
  const data = await getData();
  if (!data.sessions[sessionId]) return { ok: false, error: "Session not found" };
  data.activeSession = sessionId;
  await browser.storage.local.set({ researchData: data });
  return { ok: true };
}

// ─── Удалить сессию ────────────────────────────────────────────────────────────
async function deleteSession(sessionId) {
  const data = await getData();
  const ids = Object.keys(data.sessions);
  if (ids.length <= 1) return { ok: false, error: "Нельзя удалить последнюю сессию" };
  delete data.sessions[sessionId];
  if (data.activeSession === sessionId) {
    data.activeSession = Object.keys(data.sessions)[0];
  }
  await browser.storage.local.set({ researchData: data });
  return { ok: true };
}

// ─── Экспорт JSON ──────────────────────────────────────────────────────────────
async function exportJSON() {
  const data = await getData();
  const session = data.sessions[data.activeSession];
  const blob = new Blob(
    [JSON.stringify(session, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  await browser.downloads.download({
    url,
    filename: `${session.name.replace(/\s+/g, "_")}.json`,
    saveAs: true
  });
  return { ok: true };
}

// ─── Экспорт цитат ─────────────────────────────────────────────────────────────
async function exportCitations() {
  const data = await getData();
  const session = data.sessions[data.activeSession];
  const text = session.entries.map((e, i) =>
    `[${i + 1}] ${e.text}\n    — ${e.pageTitle}\n    ${e.url}\n    (сохранено: ${new Date(e.savedAt).toLocaleString("ru")})`
  ).join("\n\n");

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  await browser.downloads.download({
    url,
    filename: `${session.name.replace(/\s+/g, "_")}_sources.txt`,
    saveAs: true
  });
  return { ok: true };
}

// ─── Контекстное меню ─────────────────────────────────────────────────────────
browser.contextMenus.create({
  id: "save-quote",
  title: "📌 Сохранить цитату в Research Collector",
  contexts: ["selection"]
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "save-quote") return;
  const entry = {
    id: "entry_" + Date.now(),
    text: info.selectionText.trim(),
    url: tab.url,
    pageTitle: tab.title,
    savedAt: new Date().toISOString(),
    note: ""
  };
  const result = await saveEntry(entry);
  browser.tabs.sendMessage(tab.id, {
    type: "QUOTE_SAVED",
    sessionName: result.sessionName
  }).catch(() => {}); // страница может не иметь content script
});

// ─── Обработчик сообщений ─────────────────────────────────────────────────────
browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handlers = {
    GET_DATA:          () => getData(),
    SAVE_ENTRY:        () => saveEntry(msg.entry),
    DELETE_ENTRY:      () => deleteEntry(msg.entryId),
    CREATE_SESSION:    () => createSession(msg.name),
    SWITCH_SESSION:    () => switchSession(msg.sessionId),
    DELETE_SESSION:    () => deleteSession(msg.sessionId),
    EXPORT_JSON:       () => exportJSON(),
    EXPORT_CITATIONS:  () => exportCitations(),
  };
  const handler = handlers[msg.type];
  if (handler) {
    handler().then(sendResponse);
    return true;
  }
});

initStorage();
