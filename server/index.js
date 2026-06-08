// Lead Engine demo server.
//
//   Meta Ads ─▶ Landing ─▶ AI Bot (Claude) ─▶ Qualify ─▶ GoHighLevel CRM
//
// Routes:
//   GET  /                       landing page + chat widget
//   GET  /crm                    live (mock) GHL CRM dashboard
//   POST /api/chat               one turn of the AI qualification conversation
//   POST /api/webhook/meta-lead  simulates a Meta Lead Form -> GHL webhook
//   GET  /api/contacts           current CRM contacts (JSON)
//   GET  /api/stream             Server-Sent Events feed of new CRM leads
//   GET  /api/health             config / mode check

import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { qualifyTurn, MODEL_NAME } from "./claude.js";
import { pushLeadToGHL, ghlMode } from "./ghl.js";
import { getConversation, listContacts, subscribe } from "./store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "..", "public")));

// ─── AI qualification turn ───────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { sessionId, message } = req.body || {};
  if (!sessionId || !message) {
    return res.status(400).json({ error: "sessionId y message son obligatorios" });
  }

  const convo = getConversation(sessionId);
  convo.messages.push({ role: "user", content: message });

  try {
    const result = await qualifyTurn(convo.messages);
    convo.messages.push({ role: "assistant", content: result.reply });
    convo.lead = result.lead;

    // When the bot decides it has enough, push the lead into the CRM pipeline.
    let crm = null;
    if (result.readyForCRM && !convo.pushed) {
      const { record } = await pushLeadToGHL(result);
      convo.pushed = true;
      crm = record;
    }

    res.json({
      reply: result.reply,
      score: result.score,
      scoreReason: result.scoreReason,
      lead: result.lead,
      readyForCRM: result.readyForCRM,
      crm,
    });
  } catch (err) {
    console.error("[chat] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Meta Lead Form -> GHL webhook (the other entry path) ────────────────────
// Lead-form ads don't go through the chat; they fire a webhook. We score the
// raw form data with Claude, then push to GHL — same destination, no chat.
app.post("/api/webhook/meta-lead", async (req, res) => {
  const form = req.body || {};
  const synthetic = [
    {
      role: "user",
      content:
        `Lead recibido desde un formulario de Meta Ads. Datos crudos:\n` +
        JSON.stringify(form, null, 2) +
        `\nCalifica este lead y prepáralo para el CRM (readyForCRM=true).`,
    },
  ];
  try {
    const result = await qualifyTurn(synthetic);
    result.readyForCRM = true;
    const { record, ghlResult } = await pushLeadToGHL({ ...result, source: "Meta Lead Form" });
    res.json({ ok: true, mode: ghlResult.mode, contact: record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CRM data + live feed ────────────────────────────────────────────────────
app.get("/api/contacts", (_req, res) => res.json(listContacts()));

app.get("/api/stream", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: "hello" })}\n\n`);
  subscribe(res);
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    model: MODEL_NAME,
    claudeConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    ghlMode: ghlMode(),
  });
});

app.get("/crm", (_req, res) => res.sendFile(join(__dirname, "..", "public", "crm.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Lead Engine demo running → http://localhost:${PORT}`);
  console.log(`  CRM dashboard            → http://localhost:${PORT}/crm`);
  console.log(`  Model: ${MODEL_NAME}   |   GHL mode: ${ghlMode()}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(`  ⚠  ANTHROPIC_API_KEY no configurada — copia .env.example a .env\n`);
  } else {
    console.log("");
  }
});
