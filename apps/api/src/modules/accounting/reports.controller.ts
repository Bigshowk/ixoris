import { Controller, Get, Query } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { ReportsService } from "./reports.service";

@RequirePermissions("accounting.report.read")
@Controller("accounting/reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("fiscal-years")
  fiscalYears(@CurrentAuth() auth: AuthContext) {
    return this.reports.fiscalYears(auth.companyId);
  }

  @Get("trial-balance")
  trialBalance(
    @Query("fiscalYearId") fiscalYearId: string | undefined,
    @Query("periodId") periodId: string | undefined,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.reports.trialBalance(auth.companyId, { fiscalYearId, periodId });
  }

  @Get("general-ledger")
  generalLedger(
    @Query("fiscalYearId") fiscalYearId: string | undefined,
    @Query("periodId") periodId: string | undefined,
    @Query("accountCode") accountCode: string | undefined,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.reports.generalLedger(auth.companyId, { fiscalYearId, periodId }, accountCode);
  }

  @Get("journal-summary")
  journalSummary(@Query("periodId") periodId: string | undefined, @CurrentAuth() auth: AuthContext) {
    return this.reports.journalSummary(auth.companyId, periodId);
  }

  @Get("income-statement")
  incomeStatement(@Query("fiscalYearId") fiscalYearId: string, @CurrentAuth() auth: AuthContext) {
    return this.reports.incomeStatement(auth.companyId, fiscalYearId);
  }

  @Get("balance-sheet")
  balanceSheet(
    @Query("fiscalYearId") fiscalYearId: string,
    @Query("asOfDate") asOfDate: string | undefined,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.reports.balanceSheet(auth.companyId, fiscalYearId, asOfDate ? new Date(asOfDate) : undefined);
  }
}
