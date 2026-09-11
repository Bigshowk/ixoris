import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { FixedAssetsController } from "./fixed-assets.controller";
import { FixedAssetsService } from "./fixed-assets.service";
import { DepreciationService } from "./depreciation.service";

@Module({
  imports: [AccountingModule],
  controllers: [FixedAssetsController],
  providers: [FixedAssetsService, DepreciationService],
  exports: [DepreciationService],
})
export class FixedAssetsModule {}
