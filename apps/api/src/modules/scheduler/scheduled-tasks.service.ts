import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ReorderCheckService } from "../supply-chain/reorder-check.service";
import { CreditControlService } from "../credit-control/credit-control.service";
import { InstallmentsService } from "../credit-control/installments.service";
import { DepreciationService } from "../fixed-assets/depreciation.service";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Runs the three periodic business checks automatically instead of waiting
 * for someone to press the manual button on their module's page.
 *
 * This is built on plain `setInterval`/`setTimeout` rather than
 * `@nestjs/schedule`'s `@Cron` decorators because this environment has no
 * network access to install the package (confirmed: `pnpm add` and a direct
 * request to the npm registry both time out). Each `run*()` method below is
 * exactly what a `@Cron(...)`-decorated method would call, so swapping in
 * the real package later — once installable — is a drop-in change: add
 * `ScheduleModule.forRoot()` to AppModule, decorate these three methods with
 * `@Cron(CronExpression.EVERY_DAY_AT_6AM)` etc., and delete the
 * OnApplicationBootstrap/OnModuleDestroy wiring below.
 */
@Injectable()
export class ScheduledTasksService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ScheduledTasksService.name);
  private readonly timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly reorderCheck: ReorderCheckService,
    private readonly creditControl: CreditControlService,
    private readonly installments: InstallmentsService,
    private readonly depreciation: DepreciationService,
  ) {}

  onApplicationBootstrap(): void {
    // Once every 24h per check, staggered so they don't all hit the database at once.
    this.timers.push(setInterval(() => this.runSafely(this.runReorderCheck(), "Reorder check"), 24 * HOUR_MS));
    this.timers.push(setInterval(() => this.runSafely(this.runOverdueCheck(), "Overdue check"), 24 * HOUR_MS));
    this.timers.push(setInterval(() => this.runSafely(this.runDepreciation(), "Depreciation run"), 24 * HOUR_MS));

    // Also run once shortly after boot, so a freshly started API doesn't wait a full day for its first pass.
    setTimeout(() => this.runSafely(this.runReorderCheck(), "Reorder check"), 30_000);
    setTimeout(() => this.runSafely(this.runOverdueCheck(), "Overdue check"), 60_000);
    setTimeout(() => this.runSafely(this.runDepreciation(), "Depreciation run"), 90_000);
  }

  onModuleDestroy(): void {
    this.timers.forEach(clearInterval);
  }

  // setInterval/setTimeout callbacks can't be awaited — an unhandled rejection
  // here (e.g. a transient DB hiccup) would otherwise crash the whole process.
  private runSafely(task: Promise<void>, label: string): void {
    task.catch((err) => this.logger.error(`${label} crashed: ${err instanceof Error ? err.message : err}`));
  }

  private async forEachCompany(label: string, fn: (companyId: string) => Promise<void>): Promise<void> {
    let companies: { id: string }[];
    try {
      companies = await this.prisma.company.findMany({ select: { id: true } });
    } catch (err) {
      this.logger.error(`${label}: failed to list companies: ${err instanceof Error ? err.message : err}`);
      return;
    }
    for (const { id: companyId } of companies) {
      try {
        await fn(companyId);
      } catch (err) {
        this.logger.warn(`${label} failed for company ${companyId}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  /** Stock reorder thresholds — auto-drafts purchase orders / raises notifications for products below minStockAlert. */
  async runReorderCheck(): Promise<void> {
    await this.forEachCompany("Reorder check", async (companyId) => {
      const result = await this.reorderCheck.run(companyId);
      if (result.ordersCreated > 0 || result.notificationsCreated > 0) {
        this.logger.log(`Reorder check — company ${companyId}: ${JSON.stringify(result)}`);
      }
    });
  }

  /** Overdue customer invoices — blocks customers past the critical threshold and flags overdue installments. */
  async runOverdueCheck(): Promise<void> {
    await this.forEachCompany("Overdue check", async (companyId) => {
      const [blocking, installmentsResult] = await Promise.all([
        this.creditControl.runOverdueCheck(companyId),
        this.installments.markOverdue(companyId),
      ]);
      if (blocking.blocked > 0 || installmentsResult.updated > 0) {
        this.logger.log(`Overdue check — company ${companyId}: blocked=${blocking.blocked} installmentsOverdue=${installmentsResult.updated}`);
      }
    });
  }

  /** Fixed-asset depreciation — posts every schedule entry whose period has come due. */
  async runDepreciation(): Promise<void> {
    await this.forEachCompany("Depreciation run", async (companyId) => {
      const result = await this.depreciation.postDue(companyId, undefined);
      if (result.posted > 0) {
        this.logger.log(`Depreciation run — company ${companyId}: posted=${result.posted} skipped=${result.skipped}`);
      }
    });
  }
}
