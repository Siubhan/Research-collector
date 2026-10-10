async function send(msg) {
  return browser.runtime.sendMessage(msg);
}

async function init() {
  const { sessions, activeSession } = await send({ type: "GET_SESSIONS" });
  const session = sessions[activeSession];
  if (!session) return;

  document.getElementById("session-name").textContent = session.name;
  const dot = document.getElementById("session-dot");
  dot.style.background = session.color || "#7c6af7";

  document.getElementById("btn-save").addEventListener("click", async () => {
    const text = document.getElementById("input-text").value.trim();
    if (!text) return;

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    const url = tab ? tab.url : "";
    const pageTitle = tab ? tab.title : "";
    const title = document.getElementById("input-title").value.trim();
    const comment = document.getElementById("input-comment").value.trim();

    await send({ type: "ADD_ENTRY", entry: { text, url, pageTitle, title, comment } });

    document.getElementById("input-text").value = "";
    document.getElementById("input-title").value = "";
    document.getElementById("input-comment").value = "";

    const btn = document.getElementById("btn-save");
    btn.textContent = "Сохранено ✓";
    setTimeout(() => { btn.textContent = "Сохранить цитату"; }, 1500);
  });

  document.getElementById("btn-sidebar").addEventListener("click", () => {
    browser.sidebarAction.open();
    window.close();
  });
}

init();
