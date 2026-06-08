// Live CRM dashboard. Loads existing contacts, then listens on SSE for new ones.

const cards = document.getElementById("cards");
const empty = document.getElementById("empty");
const seen = new Map();

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function render(c, flash) {
  empty.style.display = "none";
  let card = seen.get(c.id);
  const tags = (c.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  const html = `
    <div class="row">
      <div class="name">${esc(c.name)}</div>
      <span class="badge ${c.score}">${esc(c.score)}</span>
    </div>
    <div class="summary">${esc(c.summary || c.scoreReason || "")}</div>
    <div class="kv">
      <span>Negocio</span><b>${esc(c.business || "—")}</b>
      <span>Necesidad</span><b>${esc(c.interest || "—")}</b>
      <span>Presupuesto</span><b>${esc(c.budget || "—")}</b>
      <span>Urgencia</span><b>${esc(c.timeline || "—")}</b>
      <span>Contacto</span><b>${esc(c.email || c.phone || "—")}</b>
    </div>
    <div class="tags">${tags}</div>
    <div class="mode">Origen: ${esc(c.source || "—")} · GHL: ${esc(c.ghlMode || "mock")}${c.ghlContactId ? " · id " + esc(c.ghlContactId) : ""}</div>
  `;
  if (!card) {
    card = document.createElement("div");
    card.className = "card";
    cards.prepend(card);
    seen.set(c.id, card);
  }
  card.innerHTML = html;
  if (flash) {
    card.classList.add("flash");
    setTimeout(() => card.classList.remove("flash"), 1200);
  }
  updateStats();
}

function updateStats() {
  const all = [...seen.values()];
  const count = (s) => [...document.querySelectorAll(`.badge.${s}`)].length;
  document.getElementById("stTotal").textContent = all.length;
  document.getElementById("stHot").textContent = count("HOT");
  document.getElementById("stWarm").textContent = count("WARM");
  document.getElementById("stCold").textContent = count("COLD");
}

async function init() {
  const contacts = await (await fetch("/api/contacts")).json();
  contacts.slice().reverse().forEach((c) => render(c, false));

  const es = new EventSource("/api/stream");
  es.onmessage = (e) => {
    const ev = JSON.parse(e.data);
    if (ev.type === "contact:new" || ev.type === "contact:update") {
      render(ev.contact, true);
    }
  };
}

init();
