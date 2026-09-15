import { FAQ_ENTRIES, TROUBLESHOOTING_ENTRIES, FaqEntry, TroubleshootingEntry, HelpDomain } from "./knowledge-base";

/**
 * Retrieval-augmented answering, entirely local: a classic TF-IDF lexical
 * search over the offline knowledge base (no embeddings model, no network
 * call, no GPU). This is the "R" in RAG — the "generation" step is
 * extractive (it returns the best-matching guide answer verbatim, optionally
 * combining two close matches) rather than a free-form LLM completion. See
 * `packages/local-ai/README` note in the main README for why: running an
 * actual quantized generative model needs downloadable weights, which this
 * offline-by-design deployment target cannot assume. The interface below
 * (`answerQuestion`) is intentionally the seam where a real local inference
 * engine (llama.cpp, ONNX Runtime, ...) can be substituted later without
 * touching any caller.
 */

export type SearchDocumentType = "faq" | "troubleshooting";

export interface SearchDocument {
  id: string;
  type: SearchDocumentType;
  domain: HelpDomain | null;
  title: string;
  body: string;
  tokens: string[];
}

export interface AskAnswer {
  found: boolean;
  documentType: SearchDocumentType | null;
  matchedTitle: string | null;
  answer: string | null;
  confidence: number; // 0..1, coverage-based — not a calibrated probability
  domain: HelpDomain | null;
  alternates: { title: string; id: string; confidence: number }[];
}

/** Strips French accents and lowercases, so "Réapprovisionnement" and "reapprovisionnement" match. */
function foldAccents(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const STOPWORDS = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "a", "au", "aux", "en", "sur", "dans", "pour",
  "par", "avec", "sans", "est", "sont", "ce", "cette", "ces", "que", "qui", "quoi", "comment", "quel", "quelle",
  "pourquoi", "mon", "ma", "mes", "son", "sa", "ses", "je", "tu", "il", "elle", "nous", "vous", "ils", "ne", "pas",
]);

export function tokenize(text: string): string[] {
  return foldAccents(text)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function buildCorpus(): SearchDocument[] {
  const faqDocs: SearchDocument[] = FAQ_ENTRIES.map((entry: FaqEntry) => ({
    id: entry.id,
    type: "faq" as const,
    domain: entry.domain,
    title: entry.question,
    body: entry.answer,
    tokens: tokenize(`${entry.question} ${entry.answer}`),
  }));
  const troubleshootingDocs: SearchDocument[] = TROUBLESHOOTING_ENTRIES.map((entry: TroubleshootingEntry) => ({
    id: entry.id,
    type: "troubleshooting" as const,
    domain: null,
    title: entry.symptom,
    body: `${entry.cause} ${entry.solution}`,
    tokens: tokenize(`${entry.symptom} ${entry.cause} ${entry.solution}`),
  }));
  return [...faqDocs, ...troubleshootingDocs];
}

let cachedCorpus: SearchDocument[] | null = null;
let cachedIdf: Map<string, number> | null = null;

function getCorpus(): { corpus: SearchDocument[]; idf: Map<string, number> } {
  if (cachedCorpus && cachedIdf) return { corpus: cachedCorpus, idf: cachedIdf };
  const corpus = buildCorpus();
  const df = new Map<string, number>();
  for (const doc of corpus) {
    for (const term of new Set(doc.tokens)) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [term, count] of df) {
    idf.set(term, Math.log((corpus.length + 1) / (count + 0.5)) + 1);
  }
  cachedCorpus = corpus;
  cachedIdf = idf;
  return { corpus, idf };
}

function termFrequencies(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

/** TF-IDF cosine-style overlap score between a query and one document. Returns 0 if no shared terms. */
function scoreDocument(queryTf: Map<string, number>, doc: SearchDocument, idf: Map<string, number>): number {
  const docTf = termFrequencies(doc.tokens);
  let dot = 0;
  let queryNorm = 0;
  let docNorm = 0;
  const allTerms = new Set([...queryTf.keys(), ...docTf.keys()]);
  for (const term of allTerms) {
    const w = idf.get(term) ?? 1;
    const q = (queryTf.get(term) ?? 0) * w;
    const d = (docTf.get(term) ?? 0) * w;
    dot += q * d;
    queryNorm += q * q;
    docNorm += d * d;
  }
  if (queryNorm === 0 || docNorm === 0) return 0;
  return dot / (Math.sqrt(queryNorm) * Math.sqrt(docNorm));
}

export interface RankedResult {
  document: SearchDocument;
  score: number;
}

/** Ranks every knowledge-base entry against a free-text query, best first. Pure function, no I/O. */
export function search(query: string, options?: { domain?: HelpDomain | null; limit?: number }): RankedResult[] {
  const { corpus, idf } = getCorpus();
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];
  const queryTf = termFrequencies(queryTokens);

  const pool = options?.domain ? corpus.filter((d) => d.domain === options.domain || d.domain === null) : corpus;

  const ranked = pool
    .map((document) => ({ document, score: scoreDocument(queryTf, document, idf) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, options?.limit ?? 5);
}

const CONFIDENT_THRESHOLD = 0.15;

/**
 * Answers a free-text support question by retrieving the closest knowledge-base
 * entry and returning its content extractively (no text generation). This is
 * what backs `POST /local-ai/ask` — see module docstring above for the
 * "why extractive, not generative" rationale.
 */
export function answerQuestion(query: string, domain?: HelpDomain | null): AskAnswer {
  const results = search(query, { domain, limit: 3 });

  if (results.length === 0 || results[0].score < CONFIDENT_THRESHOLD) {
    return {
      found: false,
      documentType: null,
      matchedTitle: null,
      answer: null,
      confidence: results[0]?.score ?? 0,
      domain: domain ?? null,
      alternates: results.map((r) => ({ title: r.document.title, id: r.document.id, confidence: r.score })),
    };
  }

  const best = results[0];
  return {
    found: true,
    documentType: best.document.type,
    matchedTitle: best.document.title,
    answer: best.document.body,
    confidence: Math.min(1, best.score),
    domain: best.document.domain,
    alternates: results.slice(1).map((r) => ({ title: r.document.title, id: r.document.id, confidence: r.score })),
  };
}
