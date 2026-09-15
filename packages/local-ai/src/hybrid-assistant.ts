import { search, CONFIDENT_THRESHOLD } from "./retrieval";
import { buildPrompt } from "./prompt-builder";
import { OllamaProvider, LlmStatus } from "./llm-provider";
import { HelpDomain } from "./knowledge-base";

export type AssistantEngine = "llm" | "rag";

export interface AssistantSource {
  title: string;
  id: string;
}

export interface HybridAnswer {
  /** Which engine actually produced `answer` — drives the "Statut IA" badge in the Aide tab. */
  engine: AssistantEngine;
  /** True if the local LLM server responded but wasn't detected/available — lets the UI show why it fell back. */
  llmDetected: boolean;
  llmModel: string | null;
  found: boolean;
  answer: string | null;
  sources: AssistantSource[];
}

const MAX_CONTEXT_DOCS = 3;
const STATUS_CACHE_MS = 30_000;

const provider = new OllamaProvider(process.env.OLLAMA_BASE_URL || "http://localhost:11434");

let cachedStatus: { status: LlmStatus; checkedAt: number } | null = null;

/**
 * Detects whether a local LLM server is reachable, caching the result briefly
 * (30s) so every keystroke/request doesn't re-probe the network — a local
 * model can also legitimately appear/disappear (started or stopped by the
 * admin) within a session, hence the short TTL rather than a permanent cache.
 */
export async function getLlmStatus(): Promise<LlmStatus> {
  if (cachedStatus && Date.now() - cachedStatus.checkedAt < STATUS_CACHE_MS) return cachedStatus.status;
  const status = await provider.detect();
  cachedStatus = { status, checkedAt: Date.now() };
  return status;
}

/** Test-only escape hatch — production code never needs this, the 30s TTL is deliberate. */
export function _resetLlmStatusCache(): void {
  cachedStatus = null;
}

/**
 * Answers a free-text support question. Always retrieves grounding context
 * from the local knowledge base first (see `retrieval.ts`), then:
 *   - if a local LLM is detected, hands it that context and generates a
 *     synthesized, conversational answer;
 *   - otherwise (or if the LLM call itself fails for any reason — a local
 *     server can time out, run out of memory, whatever), falls back to the
 *     extractive RAG answer — the exact behavior this assistant had before
 *     the LLM integration existed. The assistant never errors out to the
 *     user just because the optional LLM step didn't work.
 */
export async function answerHybrid(question: string, domain?: HelpDomain | null): Promise<HybridAnswer> {
  const results = search(question, { domain, limit: MAX_CONTEXT_DOCS });
  const status = await getLlmStatus();

  if (results.length === 0 || results[0].score < CONFIDENT_THRESHOLD) {
    return { engine: status.available ? "llm" : "rag", llmDetected: status.available, llmModel: status.model, found: false, answer: null, sources: [] };
  }

  const sources: AssistantSource[] = results.map((r) => ({ title: r.document.title, id: r.document.id }));

  if (status.available && status.model) {
    try {
      const { system, prompt } = buildPrompt(
        question,
        results.map((r) => ({ title: r.document.title, body: r.document.body })),
      );
      const generated = await provider.generate(status.model, prompt, { system });
      if (generated) {
        return { engine: "llm", llmDetected: true, llmModel: status.model, found: true, answer: generated, sources };
      }
    } catch {
      // Local server flaked mid-request — degrade to the extractive answer below rather than fail the request.
    }
  }

  const best = results[0];
  return {
    engine: "rag",
    llmDetected: status.available,
    llmModel: status.model,
    found: true,
    answer: best.document.body,
    sources: [{ title: best.document.title, id: best.document.id }],
  };
}
