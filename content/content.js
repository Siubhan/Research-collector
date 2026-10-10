browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SHOW_TOAST") {
    showToast(msg.text);
  }
});

function showToast(text) {
  const existing = document.getElementById("rc-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "rc-toast";
  toast.textContent = text;
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    background: "#1e1e2e",
    color: "#fff",
    padding: "10px 18px",
    borderRadius: "8px",
    fontSize: "14px",
    zIndex: "2147483647",
    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
    transition: "opacity 0.3s",
    opacity: "1"
  });
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
