import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { LocalAiService } from "./local-ai.service";
import { AskQuestionDto, SuggestAccountDto } from "./dto/local-ai.dto";

/**
 * 100% local — every route here runs entirely inside this API process (lexical
 * retrieval over an offline knowledge base, deterministic stock statistics,
 * keyword-based account suggestions). No outbound network call is ever made.
 * See RAPPORT_SECURITE_ET_REMEDS.md and README.md "Agent IA Local" for the
 * architecture and its honest scope (extractive RAG, not a generative LLM —
 * this deployment target cannot assume downloadable model weights).
 */
@Controller("local-ai")
export class LocalAiController {
  constructor(private readonly localAi: LocalAiService) {}

  /** No @RequirePermissions on purpose — every authenticated user can ask the help assistant, same as the static Aide page. */
  @Post("ask")
  ask(@Body() dto: AskQuestionDto) {
    return this.localAi.ask(dto.question, dto.domain);
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
