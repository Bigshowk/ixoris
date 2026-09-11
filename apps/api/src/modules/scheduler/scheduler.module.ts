import { Module } from "@nestjs/common";
import { SupplyChainModule } from "../supply-chain/supply-chain.module";
import { CreditControlModule } from "../credit-control/credit-control.module";
import { FixedAssetsModule } from "../fixed-assets/fixed-assets.module";
import { ScheduledTasksService } from "./scheduled-tasks.service";

@Module({
  imports: [SupplyChainModule, CreditControlModule, FixedAssetsModule],
  providers: [ScheduledTasksService],
})
export class SchedulerModule {}
