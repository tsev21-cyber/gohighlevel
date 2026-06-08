// The AI qualification engine. One Claude call per visitor message returns BOTH
// the next thing the bot should say AND a structured read of the lead (fields
// extracted, HOT/WARM/COLD score, and a one-line summary for the sales rep).
//
// We use Structured Outputs (output_config.format) so the model is forced to
// return valid JSON matching our schema — no fragile string parsing.

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5";

const SYSTEM_PROMPT = `Eres "Ana", la asistente de IA de una agencia que ayuda a negocios a
captar clientes con campañas de Meta Ads, embudos y automatización con GoHighLevel.

Tu trabajo en este chat:
1. Conversar de forma natural, cálida y profesional en español.
2. Calificar al lead averiguando, sin interrogar, estos datos:
   - nombre
   - tipo de negocio / sector
   - qué necesita (más clientes, automatizar seguimiento, montar embudo, etc.)
   - presupuesto mensual aproximado de inversión
   - urgencia / cuándo quiere empezar
   - email o WhatsApp para que un asesor le contacte
3. Haz UNA pregunta a la vez. Mensajes cortos. Nada de párrafos largos.
4. Cuando tengas datos suficientes (al menos necesidad + contacto), agradece y
   dile que un asesor humano le escribirá en breve.

Reglas de scoring:
- HOT: presupuesto claro y razonable + urgencia alta + datos de contacto.
- WARM: interés real pero falta presupuesto o urgencia.
- COLD: curioseando, sin presupuesto, o fuera de objetivo.
- UNKNOWN: aún no hay información suficiente.

Responde SIEMPRE con el JSON del esquema. El campo "reply" es lo único que ve
el usuario.`;

// JSON Schema for the structured response. Note: structured outputs require
// additionalProperties:false and don't support min/maxLength — keep it simple.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description: "El mensaje que el bot le dice al usuario (en español).",
    },
    lead: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        business: { type: "string" },
        interest: { type: "string" },
        budget: { type: "string" },
        timeline: { type: "string" },
      },
      required: ["name", "email", "phone", "business", "interest", "budget", "timeline"],
      additionalProperties: false,
    },
    score: {
      type: "string",
      enum: ["HOT", "WARM", "COLD", "UNKNOWN"],
    },
    scoreReason: {
      type: "string",
      description: "Una frase corta justificando el score, para el asesor.",
    },
    summary: {
      type: "string",
      description: "Resumen de 1-2 frases del lead para el equipo comercial.",
    },
    readyForCRM: {
      type: "boolean",
      description:
        "true cuando hay datos suficientes (necesidad + contacto) para enviar el lead al CRM.",
    },
  },
  required: ["reply", "lead", "score", "scoreReason", "summary", "readyForCRM"],
  additionalProperties: false,
};

/**
 * Run one turn of the qualification conversation.
 * @param {Array<{role:'user'|'assistant', content:string}>} history
 * @returns {Promise<object>} parsed structured response
 */
export async function qualifyTurn(history) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY no está configurada. Copia .env.example a .env y añade tu clave.",
    );
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: history,
    output_config: {
      format: { type: "json_schema", schema: RESPONSE_SCHEMA },
    },
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
  return JSON.parse(text);
}

export const MODEL_NAME = MODEL;
