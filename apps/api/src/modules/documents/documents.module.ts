import { Module } from "@nestjs/common";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { ApprovalsController } from "./approvals.controller";
import { ApprovalsService } from "./approvals.service";

@Module({
  controllers: [DocumentsController, ApprovalsController],
  providers: [DocumentsService, ApprovalsService],
  // ApprovalsService is consumed by SupplyChainModule (PO threshold) and TreasuryModule (expense threshold).
  exports: [ApprovalsService],
})
export class DocumentsModule {}
