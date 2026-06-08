// Chat widget: drives the AI qualification conversation against /api/chat.

const sessionId = "sess_" + Math.random().toString(36).slice(2);
const body = document.getElementById("chatBody");
const form = document.getElementById("chatForm");
const input = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

function bubble(text, who) {
  const el = document.createElement("div");
  el.className = `msg ${who}`;
  el.textContent = text;
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
  return el;
}

function qualificationBadge({ score, scoreReason, crm }) {
  const el = document.createElement("div");
  el.className = "qbadge";
  el.innerHTML =
    `Calificación IA: <span class="score ${score}">${score}</span> — ${scoreReason}` +
    (crm ? `<br>✅ Enviado al CRM (GoHighLevel) como <b>${escapeHtml(crm.name)}</b>` : "");
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

async function send(message) {
  bubble(message, "user");
  const typing = bubble("Ana está escribiendo…", "bot");
  typing.classList.add("typing");
  sendBtn.disabled = true;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message }),
    });
    const data = await res.json();
    typing.remove();

    if (data.error) {
      bubble("⚠ " + data.error, "bot");
      return;
    }
    bubble(data.reply, "bot");
    if (data.score && data.score !== "UNKNOWN") qualificationBadge(data);
  } catch (err) {
    typing.remove();
    bubble("⚠ Error de conexión: " + err.message, "bot");
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  send(text);
});

// Greeting + config pill
(async () => {
  try {
    const h = await (await fetch("/api/health")).json();
    const pill = document.getElementById("modePill");
    pill.textContent = `IA: ${h.model} · CRM: ${h.ghlMode}`;
    if (!h.claudeConfigured) pill.textContent = "⚠ falta ANTHROPIC_API_KEY";
  } catch {}
  bubble("¡Hola! 👋 Soy Ana. ¿En qué tipo de negocio trabajas y qué te gustaría mejorar: más clientes, automatizar el seguimiento, o montar un embudo?", "bot");
})();
