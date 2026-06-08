// GoHighLevel integration layer.
//
// This builds the EXACT payload GHL's v2 Contacts API expects and, if real
// credentials are present, POSTs to it. With no credentials it runs in mock
// mode: it stores the contact locally and logs the request it *would* have
// sent — so the full pipeline is visible without needing a live sub-account.

import { upsertContact } from "./store.js";

const GHL_BASE = "https://services.leadconnectorhq.com";
const hasRealCreds = () =>
  Boolean(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID);

// Map our qualified lead -> GHL contact payload (incl. tags + custom fields).
function toGhlPayload({ lead, score, scoreReason, summary, source }) {
  const [firstName, ...rest] = (lead.name || "").trim().split(" ");
  const tags = ["meta-ads", `score-${(score || "unknown").toLowerCase()}`];
  if (lead.interest) tags.push("interesado");

  return {
    locationId: process.env.GHL_LOCATION_ID || "MOCK_LOCATION",
    firstName: firstName || lead.name || "Lead",
    lastName: rest.join(" ") || undefined,
    email: lead.email || undefined,
    phone: lead.phone || undefined,
    source: source || "Meta Ads - Bot IA",
    tags,
    customFields: [
      { key: "negocio", field_value: lead.business || "" },
      { key: "necesidad", field_value: lead.interest || "" },
      { key: "presupuesto", field_value: lead.budget || "" },
      { key: "urgencia", field_value: lead.timeline || "" },
      { key: "ia_score", field_value: score || "UNKNOWN" },
      { key: "ia_resumen", field_value: summary || "" },
    ],
  };
}

/**
 * Push a qualified lead to GoHighLevel (real or mock).
 * Always records it in the local store so the CRM dashboard updates live.
 */
export async function pushLeadToGHL(qualified) {
  const payload = toGhlPayload(qualified);

  let ghlResult = { mode: "mock", contactId: null };
  if (hasRealCreds()) {
    try {
      const res = await fetch(`${GHL_BASE}/contacts/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GHL_API_KEY}`,
          "Content-Type": "application/json",
          Version: "2021-07-28",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      ghlResult = { mode: "live", contactId: data?.contact?.id ?? null, raw: data };
      console.log(`[GHL] live contact created: ${ghlResult.contactId}`);
    } catch (err) {
      console.error("[GHL] live push failed, falling back to mock:", err.message);
    }
  } else {
    console.log("[GHL] MOCK mode — would POST /contacts/:", JSON.stringify(payload, null, 2));
  }

  // Mirror into the local CRM view (this is what the dashboard renders).
  const record = upsertContact({
    name: qualified.lead.name || "Lead sin nombre",
    email: qualified.lead.email || "",
    phone: qualified.lead.phone || "",
    business: qualified.lead.business || "",
    interest: qualified.lead.interest || "",
    budget: qualified.lead.budget || "",
    timeline: qualified.lead.timeline || "",
    score: qualified.score || "UNKNOWN",
    scoreReason: qualified.scoreReason || "",
    summary: qualified.summary || "",
    tags: payload.tags,
    source: payload.source,
    ghlMode: ghlResult.mode,
    ghlContactId: ghlResult.contactId,
    ghlPayload: payload,
  });

  return { record, ghlResult };
}

export const ghlMode = () => (hasRealCreds() ? "live" : "mock");
