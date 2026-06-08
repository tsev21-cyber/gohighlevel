// In-memory store for conversations and CRM contacts, plus a tiny pub/sub so the
// CRM dashboard can update live over Server-Sent Events. In production these
// would be the GHL CRM itself + a real datastore; here they let the whole flow
// run on one machine with zero external services.

const conversations = new Map(); // sessionId -> { messages: [], lead: {} }
const contacts = [];             // qualified leads pushed to the (mock) CRM
const subscribers = new Set();   // SSE response objects watching the CRM

export function getConversation(sessionId) {
  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, { messages: [], lead: {} });
  }
  return conversations.get(sessionId);
}

export function listContacts() {
  return contacts;
}

export function upsertContact(contact) {
  const existing = contacts.find(
    (c) => contact.email && c.email === contact.email,
  );
  if (existing) {
    Object.assign(existing, contact, { updatedAt: new Date().toISOString() });
    broadcast({ type: "contact:update", contact: existing });
    return existing;
  }
  const record = {
    id: `mock_${contacts.length + 1}_${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...contact,
  };
  contacts.unshift(record);
  broadcast({ type: "contact:new", contact: record });
  return record;
}

// ─── SSE pub/sub ─────────────────────────────────────────────────────────────
export function subscribe(res) {
  subscribers.add(res);
  res.on("close", () => subscribers.delete(res));
}

export function broadcast(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of subscribers) res.write(payload);
}
