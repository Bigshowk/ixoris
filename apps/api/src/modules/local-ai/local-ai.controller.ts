import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { LocalAiService } from "./local-ai.service";
import { AskQuestionDto, SuggestAccountDto } from "./dto/local-ai.dto";

/**
 * 100% local — every route here runs entirely inside this API process or
 * talks only to a local LLM server on the same machine (never a cloud API).
 * See RAPPORT_SECURITE_ET_REMEDS.md and README.md "Agent IA Local" for the
 * hybrid architecture: a local LLM (Ollama-compatible) generates answers
 * grounded in the retrieved documentation when one is detected running;
 * otherwise the assistant transparently falls back to the extractive RAG
 * engine — never errors out to the user either way.
 */
@Controller("local-ai")
export class LocalAiController {
  constructor(private readonly localAi: LocalAiService) {}

  /** No @RequirePermissions on purpose — every authenticated user can ask the help assistant, same as the static Aide page. */
  @Post("ask")
  ask(@Body() dto: AskQuestionDto) {
    return this.localAi.ask(dto.question, dto.domain);
  }

  /** Backs the "Statut IA" badge — same no-permission rule as /ask. */
  @Get("status")
  status() {
    return this.localAi.status();
  }

  @Get("stock/anomalies")
  @RequirePermissions("stock.movement.read")
  stockAnomalies(@Query("warehouseId") warehouseId: string | undefined, @CurrentAuth() auth: AuthContext) {
    return this.localAi.stockAnomalies(auth.companyId, warehouseId);
  }

  @Post("accounting/suggest-entry")
  @RequirePermissions("accounting.journal.write")
  suggestEntry(@Body() dto: SuggestAccountDto) {
    return this.localAi.suggestJournalAccounts(dto.description);
  }
}
