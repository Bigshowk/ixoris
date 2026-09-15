export type { HelpDomain, FaqEntry, TroubleshootingEntry } from "./knowledge-base";
export { FAQ_ENTRIES, TROUBLESHOOTING_ENTRIES } from "./knowledge-base";

export type { SearchDocumentType, SearchDocument, AskAnswer, RankedResult } from "./retrieval";
export { tokenize, search, answerQuestion, CONFIDENT_THRESHOLD } from "./retrieval";

export type { LlmStatus, LlmGenerateOptions } from "./llm-provider";
export { OllamaProvider } from "./llm-provider";

export type { PromptContext } from "./prompt-builder";
export { buildPrompt, SYSTEM_PROMPT } from "./prompt-builder";

export type { AssistantEngine, AssistantSource, HybridAnswer } from "./hybrid-assistant";
export { answerHybrid, getLlmStatus, _resetLlmStatusCache } from "./hybrid-assistant";

export type {
  StockMovementKind,
  StockMovementSample,
  StockAnomalyKind,
  StockAnomalySeverity,
  StockAnomaly,
  DetectAnomaliesOptions,
} from "./anomaly-detection";
export { signedDelta, detectStockAnomalies } from "./anomaly-detection";

export type { AccountSuggestion } from "./accounting-suggest";
export { suggestAccounts } from "./accounting-suggest";
