import { Module } from "@nestjs/common";
import { CreditControlController } from "./credit-control.controller";
import { CreditControlService } from "./credit-control.service";
import { InstallmentsService } from "./installments.service";

@Module({
  controllers: [CreditControlController],
  providers: [CreditControlService, InstallmentsService],
  // Consumed by AccountingModule (invoice validation), PosModule (credit sale checkout), and SchedulerModule (daily overdue check).
  exports: [CreditControlService, InstallmentsService],
})
export class CreditControlModule {}
