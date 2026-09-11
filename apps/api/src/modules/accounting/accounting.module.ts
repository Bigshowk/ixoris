import { Module } from "@nestjs/common";
import { FiscalPeriodService } from "./fiscal-period.service";
import { JournalEntriesService } from "./journal-entries.service";
import { JournalEntriesController } from "./journal-entries.controller";
import { AccountsService } from "./accounts.service";
import { AccountsController } from "./accounts.controller";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./reports.controller";
import { InvoicesService } from "./invoices.service";
import { InvoicesController } from "./invoices.controller";
import { SuppliersService } from "./suppliers.service";
import { SuppliersController } from "./suppliers.controller";
import { LettrageService } from "./lettrage.service";
import { LettrageController } from "./lettrage.controller";
import { BankAccountsService } from "./bank-accounts.service";
import { BankAccountsController } from "./bank-accounts.controller";
import { BankStatementsService } from "./bank-statements.service";
import { BankStatementsController } from "./bank-statements.controller";
import { SalesPostingService } from "./sales-posting.service";
import { CreditControlModule } from "../credit-control/credit-control.module";

@Module({
  imports: [CreditControlModule],
  controllers: [
    JournalEntriesController,
    AccountsController,
    ReportsController,
    InvoicesController,
    SuppliersController,
    LettrageController,
    BankAccountsController,
    BankStatementsController,
  ],
  providers: [
    FiscalPeriodService,
    JournalEntriesService,
    AccountsService,
    ReportsService,
    InvoicesService,
    SuppliersService,
    LettrageService,
    BankAccountsService,
    BankStatementsService,
    SalesPostingService,
  ],
  // SalesPostingService is consumed by PosModule to auto-post completed sales.
  exports: [SalesPostingService, JournalEntriesService],
})
export class AccountingModule {}
