import { Injectable, Logger } from "@nestjs/common";
import { Employee, Payslip, PayslipLine, PayrollRun, SalaryComponent } from "@ixoris/database";
import { WELL_KNOWN_ACCOUNTS } from "@ixoris/accounting-engine";
import { PrismaService } from "../../prisma/prisma.service";
import { JournalEntriesService, AutoPostLine } from "../accounting/journal-entries.service";
import { toNumber } from "../pos/pos.mappers";

type PayslipWithLines = Payslip & { employee: Employee; lines: (PayslipLine & { component: SalaryComponent })[] };

/**
 * Posts one consolidated journal entry per payroll run to journal PA:
 *  - Debit 661 (charges de personnel) = Σ salaires bruts
 *  - Debit 664 (charges sociales) = Σ cotisations patronales
 *  - Credit 422 (personnel, rémunérations dues) = Σ nets à payer
 *  - Credit <compte configuré par composante> for each DEDUCTION/EMPLOYER_CONTRIBUTION
 *    line (falls back to 431 Sécurité sociale if the component has no glAccountId)
 * Best-effort like SalesPostingService — a misconfigured chart of accounts
 * must never block payroll validation, only leave it unposted (logged).
 *
 * One entry per run (not per payslip) matches how payroll is normally
 * booked in practice — a single summary line per pay period rather than one
 * per employee — so `Payslip.journalEntryId` is intentionally left unset;
 * traceability back to this posting goes through
 * `JournalEntry.sourceType/sourceId` ("PayrollRun"/run.id) instead.
 */
@Injectable()
export class PayrollPostingService {
  private readonly logger = new Logger(PayrollPostingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly journalEntries: JournalEntriesService,
  ) {}

  async postRun(companyId: string, userId: string, run: PayrollRun & { payslips: PayslipWithLines[] }): Promise<string | null> {
    try {
      const journal = await this.prisma.journal.findFirst({ where: { companyId, code: "PA" } });
      if (!journal) {
        this.logger.warn(`No 'PA' journal configured for company ${companyId} — payroll run ${run.period} not posted`);
        return null;
      }

      const accounts = await this.prisma.account.findMany({ where: { companyId } });
      const accountCodeById = new Map(accounts.map((a) => [a.id, a.code]));

      let totalGross = 0;
      let totalNet = 0;
      let totalEmployerContributions = 0;
      const creditByAccount = new Map<string, number>();

      for (const payslip of run.payslips) {
        totalGross += toNumber(payslip.grossSalary);
        totalNet += toNumber(payslip.netSalary);
        totalEmployerContributions += toNumber(payslip.totalEmployerContributions);

        for (const line of payslip.lines) {
          if (line.component.type === "EARNING") continue; // folded into the 661 total below
          const accountCode = (line.component.glAccountId && accountCodeById.get(line.component.glAccountId)) || WELL_KNOWN_ACCOUNTS.securiteSociale;
          creditByAccount.set(accountCode, round2((creditByAccount.get(accountCode) ?? 0) + toNumber(line.amount)));
        }
      }

      const label = `Paie ${run.period}`;
      const lines: AutoPostLine[] = [
        { accountCode: WELL_KNOWN_ACCOUNTS.chargesPersonnel, debit: round2(totalGross), credit: 0, label },
        ...(totalEmployerContributions > 0
          ? [{ accountCode: WELL_KNOWN_ACCOUNTS.chargesSocialesPersonnel, debit: round2(totalEmployerContributions), credit: 0, label }]
          : []),
        { accountCode: WELL_KNOWN_ACCOUNTS.personnelRemunerationsDues, debit: 0, credit: round2(totalNet), label },
        ...[...creditByAccount.entries()].map(([accountCode, amount]) => ({ accountCode, debit: 0, credit: amount, label })),
      ];

      const entry = await this.journalEntries.postBalancedEntry(companyId, userId, {
        journalId: journal.id,
        date: new Date(),
        description: label,
        sourceType: "PayrollRun",
        sourceId: run.id,
        lines,
      });

      return entry.id;
    } catch (err) {
      this.logger.warn(`Failed to auto-post payroll run ${run.period}: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
