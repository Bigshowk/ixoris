import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { HrModule } from "../hr/hr.module";
import { PayrollRunsService } from "./payroll-runs.service";
import { PayrollRunsController } from "./payroll-runs.controller";
import { PayrollPostingService } from "./payroll-posting.service";
import { PayslipPdfService } from "./payslip-pdf.service";
import { PayslipsController } from "./payslips.controller";
import { BankTransferService } from "./bank-transfer.service";
import { BankTransferController } from "./bank-transfer.controller";

@Module({
  imports: [AccountingModule, HrModule],
  controllers: [PayrollRunsController, PayslipsController, BankTransferController],
  providers: [PayrollRunsService, PayrollPostingService, PayslipPdfService, BankTransferService],
})
export class PayrollModule {}
