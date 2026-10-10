// ─── Storage helpers ──────────────────────────────────────────────────────────

const DEFAULT_SESSION_NAME = "Новая работа";

async function getData() {
  const result = await browser.storage.local.get(["sessions", "activeSession"]);
  if (!result.sessions) {
    const id = generateId();
    const sessions = {
      [id]: { id, name: DEFAULT_SESSION_NAME, color: "#7c6af7", createdAt: Date.now(), entries: [] }
    };
    await browser.storage.local.set({ sessions, activeSession: id });
    return { sessions, activeSession: id };
  }
  return result;
}

async function setData(data) {
  await browser.storage.local.set(data);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── Text Fragment helper ─────────────────────────────────────────────────────

function buildSourceUrl(text, rawUrl) {
  try {
    const url = new URL(rawUrl);
    const isPdf = url.pathname.toLowerCase().endsWith(".pdf") ||
                  (url.searchParams.has("file") && rawUrl.toLowerCase().includes(".pdf"));
    if (isPdf) return rawUrl;

    const trimmed = text.trim().replace(/\s+/g, " ");
    if (trimmed.length === 0) return rawUrl;

    url.hash = "";
    const base = url.toString();

    let fragment;
    if (trimmed.length <= 100) {
      fragment = encodeTextFragment(trimmed);
    } else {
      const start = trimmed.slice(0, 50).trim();
      const end = trimmed.slice(-50).trim();
      fragment = encodeTextFragment(start) + "," + encodeTextFragment(end);
    }

    return base + "#:~:text=" + fragment;
  } catch {
    return rawUrl;
  }
}

function encodeTextFragment(str) {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

function getFaviconUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return `${url.protocol}//${url.hostname}/favicon.ico`;
  } catch {
    return "";
  }
}

// ─── Session operations ───────────────────────────────────────────────────────

async function getSessions() {
  const data = await getData();
  return { sessions: data.sessions, activeSession: data.activeSession };
}

async function createSession(name, color) {
  const data = await getData();
  const id = generateId();
  data.sessions[id] = { id, name: name || DEFAULT_SESSION_NAME, color: color || "#7c6af7", createdAt: Date.now(), entries: [] };
  data.activeSession = id;
  await setData(data);
  return { ok: true, id };
}

async function renameSession(sessionId, name, color) {
  const data = await getData();
  if (!data.sessions[sessionId]) return { ok: false, error: "Session not found" };
  if (name !== undefined) data.sessions[sessionId].name = name;
  if (color !== undefined) data.sessions[sessionId].color = color;
  await setData(data);
  return { ok: true };
}

async function switchSession(sessionId) {
  const data = await getData();
  if (!data.sessions[sessionId]) return { ok: false, error: "Session not found" };
  data.activeSession = sessionId;
  await setData(data);
  return { ok: true };
}

async function deleteSession(sessionId) {
  const data = await getData();
  const ids = Object.keys(data.sessions);
  if (ids.length <= 1) return { ok: false, error: "Cannot delete last session" };
  delete data.sessions[sessionId];
  if (data.activeSession === sessionId) {
    data.activeSession = Object.keys(data.sessions)[0];
  }
  await setData(data);
  return { ok: true, activeSession: data.activeSession };
}

// ─── Entry operations ─────────────────────────────────────────────────────────

async function addEntry(entry) {
  const data = await getData();
  const session = data.sessions[data.activeSession];
  session.entries.push({ id: generateId(), ...entry, savedAt: Date.now() });
  await setData(data);
  return { ok: true };
}

async function updateEntry(entryId, fields) {
  const data = await getData();
  for (const session of Object.values(data.sessions)) {
    const idx = session.entries.findIndex(e => e.id === entryId);
    if (idx !== -1) {
      session.entries[idx] = { ...session.entries[idx], ...fields };
      await setData(data);
      return { ok: true };
    }
  }
  return { ok: false, error: "Entry not found" };
}

async function deleteEntry(entryId) {
  const data = await getData();
  const sessionId = data.activeSession;
  data.sessions[sessionId].entries = data.sessions[sessionId].entries
    .filter(e => e.id !== entryId);
  await setData(data);
  return { ok: true };
}

async function moveEntry(entryId, targetSessionId) {
  const data = await getData();
  let entry = null;
  for (const session of Object.values(data.sessions)) {
    const idx = session.entries.findIndex(e => e.id === entryId);
    if (idx !== -1) {
      entry = session.entries.splice(idx, 1)[0];
      break;
    }
  }
  if (!entry) return { ok: false, error: "Entry not found" };
  if (!data.sessions[targetSessionId]) return { ok: false, error: "Target session not found" };
  data.sessions[targetSessionId].entries.push(entry);
  await setData(data);
  return { ok: true };
}

// ─── Export ───────────────────────────────────────────────────────────────────

async function exportJson() {
  const data = await getData();
  const session = data.sessions[data.activeSession];
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  await browser.downloads.download({
    url,
    filename: `${session.name.replace(/\s+/g, "_")}_sources.json`,
    saveAs: true
  });
  return { ok: true };
}

async function exportTxt() {
  const data = await getData();
  const session = data.sessions[data.activeSession];
  const text = session.entries.map((e, i) => {
    let out = `[${i + 1}]${e.title ? " " + e.title : ""}\n${e.text}\n    — ${e.pageTitle}\n    ${e.url}\n    (сохранено: ${new Date(e.savedAt).toLocaleString("ru")})`;
    if (e.comment) out += `\n    Комментарий: ${e.comment}`;
    return out;
  }).join("\n\n");

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  await browser.downloads.download({
    url,
    filename: `${session.name.replace(/\s+/g, "_")}_sources.txt`,
    saveAs: true
  });
  return { ok: true };
}

async function exportMarkdown() {
  const data = await getData();
  const session = data.sessions[data.activeSession];
  const date = new Date().toLocaleDateString("ru");

  let md = `# ${session.name}\n\n_Экспорт: ${date}_\n\n---\n\n`;

  session.entries.forEach((e, i) => {
    if (e.title) md += `## ${e.title}\n\n`;
    md += `> ${e.text.replace(/\n/g, "\n> ")}\n\n`;
    const sourceLabel = e.pageTitle || e.url;
    md += `**Источник:** [${sourceLabel}](${e.url})\n\n`;
    if (e.comment) md += `**Комментарий:** ${e.comment}\n\n`;
    md += `---\n\n`;
  });

  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  await browser.downloads.download({
    url,
    filename: `${session.name.replace(/\s+/g, "_")}_sources.md`,
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

  const text = info.selectionText.trim();
  if (!text) return;

  const sourceUrl = buildSourceUrl(text, tab.url);
  const favicon = getFaviconUrl(tab.url);

  await addEntry({
    text,
    url: sourceUrl,
    pageTitle: tab.title || "",
    favicon,
    title: "",
    comment: "",
    color: ""
  });

  try {
    await browser.tabs.sendMessage(tab.id, { type: "SHOW_TOAST", text: "Цитата сохранена 📌" });
  } catch {}
});

// ─── Message handler ──────────────────────────────────────────────────────────

browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handle = async () => {
    switch (msg.type) {
      case "GET_SESSIONS":     return getSessions();
      case "CREATE_SESSION":   return createSession(msg.name, msg.color);
      case "RENAME_SESSION":   return renameSession(msg.sessionId, msg.name, msg.color);
      case "SWITCH_SESSION":   return switchSession(msg.sessionId);
      case "DELETE_SESSION":   return deleteSession(msg.sessionId);
      case "ADD_ENTRY":        return addEntry(msg.entry);
      case "UPDATE_ENTRY":     return updateEntry(msg.entryId, msg.fields);
      case "DELETE_ENTRY":     return deleteEntry(msg.entryId);
      case "MOVE_ENTRY":       return moveEntry(msg.entryId, msg.targetSessionId);
      case "EXPORT_JSON":      return exportJson();
      case "EXPORT_TXT":       return exportTxt();
      case "EXPORT_MD":        return exportMarkdown();
      default: return { ok: false, error: "Unknown message type" };
    }
  };
  handle().then(sendResponse);
  return true;
});
