/**
 * Gateway to a local LLM inference server, speaking the Ollama HTTP API
 * (https://github.com/ollama/ollama/blob/main/docs/api.md) — the de facto
 * standard for running quantized instruction models (Mistral, Llama 3,
 * Phi-3...) on a single machine with zero cloud dependency. Any other
 * OpenAI-compatible-ish local server that implements the same two routes
 * (`GET /api/tags`, `POST /api/generate`) works unmodified — llama.cpp's
 * `server` binary and LM Studio both do.
 *
 * Uses the platform `fetch` (global since Node 18) — no HTTP client
 * dependency needed, consistent with this package's zero-dependency policy.
 */

export interface LlmStatus {
  available: boolean;
  model: string | null;
  baseUrl: string;
}

export interface LlmGenerateOptions {
  system?: string;
  timeoutMs?: number;
}

/** Preference order when several models are installed — smallest/fastest instruction models first. */
const PREFERRED_MODELS = ["phi3:mini", "mistral:7b-instruct", "llama3:8b"];

interface OllamaTagsResponse {
  models?: { name: string }[];
}

interface OllamaGenerateResponse {
  response?: string;
  done?: boolean;
}

const DEFAULT_DETECT_TIMEOUT_MS = 1500;
const DEFAULT_GENERATE_TIMEOUT_MS = 45_000;

export class OllamaProvider {
  constructor(private readonly baseUrl: string = "http://localhost:11434") {}

  /**
   * Probes the server with a short timeout — never throws, always resolves.
   * Called on (roughly) every assistant request, so it must fail fast and
   * quietly when nothing is listening (the common case in most deployments
   * that haven't installed a local model).
   */
  async detect(timeoutMs: number = DEFAULT_DETECT_TIMEOUT_MS): Promise<LlmStatus> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: controller.signal });
      if (!res.ok) return { available: false, model: null, baseUrl: this.baseUrl };
      const data = (await res.json()) as OllamaTagsResponse;
      const names = (data.models ?? []).map((m) => m.name);
      const model = PREFERRED_MODELS.find((preferred) => names.includes(preferred)) ?? names[0] ?? null;
      return { available: model !== null, model, baseUrl: this.baseUrl };
    } catch {
      // Connection refused, DNS failure, timeout — all mean "no local LLM available right now".
      return { available: false, model: null, baseUrl: this.baseUrl };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Single-shot (non-streaming) completion. Throws on any failure — the caller decides how to degrade. */
  async generate(model: string, prompt: string, options?: LlmGenerateOptions): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? DEFAULT_GENERATE_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, system: options?.system, stream: false }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Ollama generate failed: HTTP ${res.status}`);
      const data = (await res.json()) as OllamaGenerateResponse;
      return (data.response ?? "").trim();
    } finally {
      clearTimeout(timer);
    }
  }
}
