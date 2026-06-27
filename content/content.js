// content.js — выполняется на каждой странице

// ─── Всплывающий тост при сохранении цитаты ───────────────────────────────────
function showToast(sessionName) {
  // Удалить предыдущий тост если есть
  const existing = document.getElementById("rc-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "rc-toast";
  toast.textContent = `📌 Сохранено в «${sessionName}»`;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483647;
    background: #1a1a2e;
    color: #e8e8f0;
    padding: 12px 18px;
    border-radius: 8px;
    font: 14px/1.4 -apple-system, sans-serif;
    box-shadow: 0 4px 20px rgba(0,0,0,0.35);
    border-left: 3px solid #7c6af7;
    transition: opacity 0.3s ease;
    opacity: 1;
  `;

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ─── Слушать сообщения от background ──────────────────────────────────────────
browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === "QUOTE_SAVED") {
    showToast(msg.sessionName);
  }
});
