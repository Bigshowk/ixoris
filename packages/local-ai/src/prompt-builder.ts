export interface PromptContext {
  title: string;
  body: string;
}

/**
 * Role + guardrails for the local LLM. Kept short and directive: small
 * instruction models (phi3:mini, 7-8B class) follow simple, explicit
 * instructions far more reliably than long elaborate system prompts.
 */
export const SYSTEM_PROMPT =
  "Tu es l'assistant expert intégré à IXORIS ERP, un progiciel de gestion pour PME d'Afrique de l'Ouest " +
  "(caisse/POS, comptabilité SYSCOHADA, RH/paie, logistique). Réponds en français, de façon synthétique, " +
  "professionnelle et directement exploitable, en 3 à 6 phrases maximum. Base ta réponse UNIQUEMENT sur le " +
  "contexte fourni ci-dessous, extrait de la documentation officielle du logiciel. Si le contexte ne permet " +
  "pas de répondre avec certitude, dis-le clairement plutôt que d'inventer une réponse.";

/** Builds the (system, prompt) pair sent to the local LLM, grounded in retrieved documentation passages. */
export function buildPrompt(question: string, context: PromptContext[]): { system: string; prompt: string } {
  const contextBlock = context.map((c, i) => `[Extrait ${i + 1} — ${c.title}]\n${c.body}`).join("\n\n");
  const prompt = `Contexte documentation IXORIS :\n${contextBlock}\n\nQuestion de l'utilisateur : ${question}\n\nRéponse :`;
  return { system: SYSTEM_PROMPT, prompt };
}
