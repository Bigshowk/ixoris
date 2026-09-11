import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { DocumentsModule } from "../documents/documents.module";
import { CashBoxesController } from "./cashboxes.controller";
import { CashBoxesService } from "./cashboxes.service";
import { CashTransfersController } from "./transfers.controller";
import { CashTransfersService } from "./transfers.service";
import { TreasuryPostingService } from "./treasury-posting.service";

@Module({
  imports: [AccountingModule, DocumentsModule],
  controllers: [CashBoxesController, CashTransfersController],
  providers: [CashBoxesService, CashTransfersService, TreasuryPostingService],
  // TreasuryPostingService is consumed by PosModule to post the Z-de-caisse variance.
  exports: [TreasuryPostingService],
})
export class TreasuryModule {}
