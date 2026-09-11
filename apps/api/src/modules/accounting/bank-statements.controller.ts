import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { BankStatementsService } from "./bank-statements.service";
import { ImportBankStatementDto } from "./dto/import-bank-statement.dto";
import { ManualMatchDto } from "./dto/manual-match.dto";

@RequirePermissions("accounting.bank.reconcile")
@Controller("accounting/bank-statements")
export class BankStatementsController {
  constructor(private readonly bankStatements: BankStatementsService) {}

  @Post("import")
  import(@Body() dto: ImportBankStatementDto, @CurrentAuth() auth: AuthContext) {
    return this.bankStatements.import(auth.companyId, dto);
  }

  @Get()
  list(@Query("bankAccountId") bankAccountId: string | undefined, @CurrentAuth() auth: AuthContext) {
    return this.bankStatements.list(auth.companyId, bankAccountId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.bankStatements.findOne(auth.companyId, id);
  }

  @Get(":id/summary")
  summary(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.bankStatements.summary(auth.companyId, id);
  }

  @Post(":id/auto-match")
  autoMatch(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.bankStatements.autoMatch(auth.companyId, id);
  }

  @Post(":id/lines/:lineId/match")
  manualMatch(@Param("id") id: string, @Param("lineId") lineId: string, @Body() dto: ManualMatchDto, @CurrentAuth() auth: AuthContext) {
    return this.bankStatements.manualMatch(auth.companyId, id, lineId, dto);
  }
}
