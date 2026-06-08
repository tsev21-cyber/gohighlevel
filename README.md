# Lead Engine — Demo (Meta Ads → Bot IA → GoHighLevel)

A small but complete, runnable system that reproduces the exact pipeline a
lead-gen client asks for:

```
Meta Ads ─▶ Landing ─▶ AI Bot (Claude) ─▶ Qualification ─▶ GoHighLevel CRM
```

- **AI bot on a server (VPS-ready):** a Node.js backend with conversational
  qualification powered by the **real Anthropic Claude API**.
- **Automatic lead qualification:** every visitor is scored `HOT / WARM / COLD`
  with a one-line summary for the sales rep.
- **GoHighLevel connection:** qualified leads are pushed with the **exact GHL v2
  `/contacts` payload** (contact + tags + custom fields). Runs in mock mode out
  of the box; add real credentials to hit a live sub-account.
- **Two entry paths:** the chat bot, and a **Meta Lead Form → webhook → GHL**
  endpoint.
- **Live CRM dashboard:** leads appear in real time over Server-Sent Events.

## Run it

Requires **Node.js 20.6+** (uses the built-in `--env-file` flag).

```bash
cd demo
npm install
cp .env.example .env          # then add your ANTHROPIC_API_KEY
npm start
```

Open:

- Landing + chat bot → http://localhost:3000
- Live CRM dashboard → http://localhost:3000/crm

Chat with the bot on the landing page; once it has enough info it scores the
lead and it appears instantly on the `/crm` board.

### Try the Meta Lead Form webhook

```bash
curl -X POST http://localhost:3000/api/webhook/meta-lead \
  -H "Content-Type: application/json" \
  -d '{"full_name":"María López","email":"maria@tienda.com","phone":"+34600111222","mensaje":"Quiero más ventas para mi tienda de ropa, presupuesto 800€/mes, empezar ya"}'
```

## Configuration (`.env`)

| Variable            | Purpose                                                      |
| ------------------- | ----------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | Required. Powers the AI qualification.                      |
| `CLAUDE_MODEL`      | Default `claude-haiku-4-5` (fast/cheap). Use `claude-opus-4-8` for max quality. |
| `GHL_API_KEY`       | Optional. Set to push to a **real** GoHighLevel sub-account. |
| `GHL_LOCATION_ID`   | Optional. Your GHL location/sub-account id.                  |
| `PORT`              | Default `3000`.                                             |

With `GHL_*` blank the demo runs in **mock mode**: it stores leads locally and
logs the exact request it would send to GHL — so the whole flow is visible
without a live account.

## How it maps to the real production system

| Demo piece                | In production                                            |
| ------------------------- | ------------------------------------------------------- |
| `server/` (Node app)      | Deployed to a **VPS** (PM2 / Docker), behind HTTPS.     |
| `claude.js`               | Same Claude API; can add RAG / knowledge base per client. |
| `ghl.js` mock             | Real GHL API v2 + native workflows/automations.         |
| In-memory store + SSE     | GHL CRM + a database; WhatsApp / email as channels.     |
| Meta Lead webhook         | Real Meta Lead Ads webhook subscription.                |

## Project layout

```
demo/
├─ server/
│  ├─ index.js     Express routes (chat, webhook, CRM feed)
│  ├─ claude.js    AI qualification engine (structured outputs)
│  ├─ ghl.js       GoHighLevel integration (real + mock)
│  └─ store.js     in-memory store + SSE pub/sub
├─ public/         landing, chat widget, live CRM dashboard
├─ .env.example
└─ package.json
```
